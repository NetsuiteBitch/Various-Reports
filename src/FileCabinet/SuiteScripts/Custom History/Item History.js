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
                    title: 'Item History',
                    hideNavBar: false
                }
            );

            form.addSubmitButton( { label: 'Get History' } );


            var Item_Number = form.addField(
                {
                    id: 'item',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Item',
                    source: 'item'
                });

            Item_Number.isMandatory = true



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

            log.debug(context.request.parameters.force)
            log.debug("yay")

            // If the form has been submitted...
            if ( context.request.method == 'POST' || context.request.parameters.force) {
                var dtodate = formatdate(new Date)
                var dfromdate = new Date()
                dfromdate.setMonth(dfromdate.getMonth()-1)
                dfromdate = formatdate(dfromdate)

                To_Date.defaultValue = context.request.parameters.todate || dtodate
                From_Date.defaultValue = context.request.parameters.fromdate || dfromdate

                Item_Number.defaultValue = context.request.parameters.item


                formProcess( context, form ,context.request.parameters.item, context.request.parameters.fromdate || dfromdate, context.request.parameters.todate || dtodate);

            }else{
                To_Date.defaultValue = new Date
                From_Date.defaultValue = new Date
            }

            // Display the form.
            context.response.writePage( form );

        }

    }

}


function formProcess( context, form , item, fromdate, todate) {

    var theQuery = `
        SELECT * FROM

            (SELECT
            
            
            Document_Number,
            Transaction_Type,
            Date,
            Time,
            Item_Number,
            CONCAT(CONCAT(ROUND(TRANSACTION_QUANTITY,4),' '), Stock_UOM) as TRANSACTION_QUANTITY,
            LOT,
            CONCAT(CONCAT(ROUND(SUM(TRANSACTION_QUANTITY) OVER (Order BY Date, TIME, Line),2), ' '), Stock_UOM) as Snapshot_Quantity 
            
            
            

            FROM 


            (
            SELECT
            '<a style="color:#0394fc;" href="https://4287944.app.netsuite.com/app/accounting/transactions/invadjst.nl?id=' || Transaction.id || '&whence=" >' || Transaction.tranid || '</a>' AS Document_Number,
           --  Transaction.tranid, 
            BUILTIN.DF(Transaction.type) as Transaction_Type, 
            Transaction.Trandate as Date,
            TO_CHAR (Transaction.createddate, 'HH:MI:SS AM') as Time, 
            '<a style="color:#0394fc;" href="https://4287944.app.netsuite.com/app/common/item/item.nl?id=' || Transactionline.item || '&whence=" >' || BUILTIN.DF(Transactionline.item) || '</a>' AS Item_Number,
            --BUILTIN.DF(Transactionline.item) as Item_Number, 
            --BUILTIN.DF(InventoryAssignment.bin) as BIN_NUMBER, 
            InventoryAssignment.quantity/unitsTypeUom.conversionrate as TRANSACTION_QUANTITY, 
            UnitsTypeUom.unitname as Stock_UOM,
            BUILTIN.DF(inventoryAssignment.inventorynumber) as LOT,
            
            Transactionline.linesequencenumber as Line,
            
            
            
            
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
            AND Transactionline.item = ${item}
            AND BUILTIN.DF(Transaction.type) != 'Bin Transfer' 
            
            ORDER BY Transaction.trandate, time, Transactionline.linesequencenumber))



            WHERE Date

            BETWEEN

            TO_DATE('${fromdate}','MM/DD/YYYY') 
            AND
            TO_DATE('${todate}', 'MM/DD/YYYY')
            
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