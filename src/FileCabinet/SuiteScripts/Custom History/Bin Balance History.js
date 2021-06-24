/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */



var
    log,
    query,
    serverWidget,
    historyRows = 100;


define( [ 'N/log', 'N/query', 'N/ui/serverWidget', 'N/search' ], main );


function main( logModule, queryModule, serverWidgetModule , search) {

    // Set module references.
    log = logModule;
    query= queryModule;
    serverWidget = serverWidgetModule;

    return {

        onRequest: function( context ) {

            // Create a form.
            var form = serverWidget.createForm(
                {
                    title: 'Bin Balance History',
                    hideNavBar: false
                }
            );

            form.addSubmitButton( { label: 'Get History' } );


            var Bin_Id = form.addField(
                {
                    id: 'bin',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Bin Name',
                    source: 'bin'
                });

            Bin_Id.isMandatory = true


            var Item_Number = form.addField(
                {
                    id: 'item',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Item',
                    source: 'item'
                });



            var From_Date = form.addField({
                id: 'fromdate',
                type: serverWidget.FieldType.DATE,
                label: 'From'
            })
            From_Date.isMandatory = true

            var To_Date = form.addField({
                id: 'todate',
                type: serverWidget.FieldType.DATE,
                label: 'To'
            })


            To_Date.isMandatory = true


            // If the form has been submitted...
            if ( context.request.method == 'POST' ) {

                From_Date.defaultValue = context.request.parameters.fromdate
                To_Date.defaultValue = context.request.parameters.fromdate
                Bin_Id.defaultValue = context.request.parameters.bin


                if(context.request.parameters.item){
                    var querypiece = `AND Transactionline.item = ${context.request.parameters.item}`
                }else{
                    var querypiece = ''
                }


                formProcess( context, form ,querypiece,context.request.parameters.bin, context.request.parameters.fromdate, context.request.parameters.todate);

            }

            // Display the form.
            context.response.writePage( form );

        }

    }

}


function formProcess( context, form ,querypiece, bin, fromdate, todate) {

    var theQuery = `
                SELECT * FROM

                (SELECT *, 


                CONCAT(CONCAT(SUM(STOCK_QUANTITY) OVER (Partition by Item_Number  ORDER BY Trandate, Time), ' '), Unitname)  as Snapshot_Quantity From 


                (SELECT  Transaction.tranid
                       ,BUILTIN.DF(Transaction.type) as Tran_Type
                       ,Transaction.trandate
                       ,BUILTIN.DF(Transaction.createdby)
                       ,TO_CHAR (Transaction.createddate,'HH:MI:SS AM')          AS Time
                       ,BUILTIN.DF(Transactionline.item)                         AS Item_Number
                       ,ROUND(InventoryAssignment.quantity/unitsTypeUom.conversionrate, 4) AS STOCK_QUANTITY
                       ,UnitsTypeUom.unitname 
                ,BUILTIN.DF(InventoryAssignment.bin) as Bin


                FROM Transaction
                INNER JOIN Transactionline
                ON Transaction.id = Transactionline.transaction
                INNER JOIN InventoryAssignment
                ON transactionLine.id = inventoryAssignment.transactionline 
                AND transactionLine.transaction = inventoryAssignment.transaction
                INNER JOIN Item
                ON Transactionline.item = Item.id
                INNER JOIN unitsTypeUom
                ON item.stockunit = unitsTypeUom.internalid
                WHERE Transactionline.isinventoryaffecting = 'T'
                AND InventoryAssignment.Bin = ${bin}
                ${querypiece}
                
                ORDER BY Transaction.trandate, time 

                )
                )

                WHERE Trandate 
                BETWEEN 

                TO_DATE('${fromdate}', 'MM/DD/YYYY')
                AND
                TO_DATE('${todate}', 'MM/DD/YYYY')
                
                
                ORDER BY Trandate, Time 
                `
    log.debug("Query",theQuery)

    try {

        // Run the query.
        var queryResults = query.runSuiteQL(
            {
                query: theQuery
            }
        );

        // Get the mapped results.
        var records = queryResults.asMappedResults();

        // If records were returned...
        if ( records.length > 0 ) {

            // Create a sublist for the results.
            var resultsSublist = form.addSublist(
                {
                    id : 'results_sublist',
                    label : 'Balance History',
                    type : serverWidget.SublistType.LIST
                }
            );

            // Get the column names.
            var columnNames = Object.keys( records[0] );

            // Loop over the column names...
            for ( i = 0; i < columnNames.length; i++ ) {

                // Add the column to the sublist as a field.
                resultsSublist.addField(
                    {
                        id: 'custpage_results_sublist_col_' + i,
                        type: serverWidget.FieldType.TEXT,
                        label: columnNames[i]
                    }
                );

            }

            // Add the records to the sublist...
            for ( r = 0; r < records.length; r++ ) {

                // Get the record.
                var record = records[r];

                // Loop over the columns...
                for ( c = 0; c < columnNames.length; c++ ) {

                    // Get the column name.
                    var column = columnNames[c];

                    // Get the column value.
                    var value = record[column];

                    // If the column has a value...
                    if ( value != null ) {

                        // Get the value as a string.
                        value = value.toString();

                        // If the value is too long to be displayed in the sublist...
                        if ( value.length > 300 ) {

                            // Truncate the value.
                            value = value.substring( 0, 297 ) + '...';

                        }

                        // Add the column value.
                        resultsSublist.setSublistValue(
                            {
                                id : 'custpage_results_sublist_col_' + c,
                                line : r,
                                value : value
                            }
                        );

                    }

                }

            }

            // Add an inline HTML field so that JavaScript can be injected.
            var jsField = form.addField(
                {
                    id: 'custpage_field_js',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Javascript'
                }
            );

            // Add Javascript to make the first row bold, and add a tooltip.
            jsField.defaultValue = '<script>\r\n';
            jsField.defaultValue += 'document.addEventListener(\'DOMContentLoaded\', function() {';
            jsField.defaultValue += 'document.getElementById("results_sublistrow0").style["font-weight"]="bold";\r\n';
            jsField.defaultValue += 'document.getElementById("results_sublistrow0").title="This is the balance as of ' + context.request.parameters.custpage_field_date + '.";\r\n';
            jsField.defaultValue += '}, false);';
            jsField.defaultValue += '</script>';

        } else {

            // Add an "Error" field.
            var errorField = form.addField(
                {
                    id: 'custpage_field_error',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Error'
                }
            );

            errorField.defaultValue = 'No history found for: ' + context.request.parameters.custpage_field_itemid;

            // Add an inline HTML field so that JavaScript can be injected.
            var jsField = form.addField(
                {
                    id: 'custpage_field_js',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Javascript'
                }
            );

            // Add Javascript to make the error field red.
            jsField.defaultValue = '<script>\r\n';
            jsField.defaultValue += 'document.addEventListener(\'DOMContentLoaded\', function() {';
            jsField.defaultValue += 'document.getElementById("custpage_field_error").style.background="red";\r\n';
            jsField.defaultValue += 'document.getElementById("custpage_field_error").style.color="white";\r\n';
            jsField.defaultValue += '}, false);';
            jsField.defaultValue += '</script>';

        }

    } catch( e ) {

        var errorField = form.addField(
            {
                id: 'custpage_field_error',
                type: serverWidget.FieldType.LONGTEXT,
                label: 'Error'
            }
        );

        errorField.defaultValue = e.message;

    }

}

function formatdate(jsdate){
    var dd = String(jsdate.getDate()).padStart(2, '0');
    var mm = String(jsdate.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = jsdate.getFullYear();
    return mm + '/' + dd + '/' + yyyy;
}