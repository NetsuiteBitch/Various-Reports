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
                    title: 'Bin Transfer History',
                    hideNavBar: false
                }
            );

            form.addSubmitButton( { label: 'Get History' } );

            var Bin_Number = form.addField(
                {
                    id: 'bin',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Bin Number',
                    source: 'bin'
                }
            );

            var Item_Number = form.addField(
                {
                    id: 'item',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Item',
                    source: 'item'
                });

            var LotField = form.addField({
                id: 'lotnumber',
                type: serverWidget.FieldType.TEXT,
                label: 'Lot Number (Partial or Full)'
            })

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


                if (context.request.parameters.bin || context.request.parameters.item || context.request.parameters.lotnumber){
                    if (context.request.parameters.item){

                        var itemquerypiece = `AND table1.itinternalid = '${context.request.parameters.item}'\n`
                    }else {
                        var itemquerypiece = ''
                    }

                    if (context.request.parameters.bin){
                        var binnumber = search.lookupFields({
                            type: "bin",
                            id:context.request.parameters.bin,
                            columns: "binnumber"
                        }).binnumber
                        var binquerypeice = `AND (table1.From_Bin = '${binnumber}' OR table2.To_Bin = '${binnumber}')\n`
                    }else {binquerypeice = ''}

                    if (context.request.parameters.lotnumber){
                        var lotquerypiece = `AND table1.Lot_Number LIKE '%${context.request.parameters.lotnumber}%'\n`
                    }else {
                        var lotquerypiece = ''
                    }

                    var querypiece = itemquerypiece + binquerypeice + lotquerypiece

                } else{
                    var querypiece = ''
                }


                formProcess( context, form ,querypiece, context.request.parameters.fromdate, context.request.parameters.todate);

            }

            // Display the form.
            context.response.writePage( form );

        }

    }

}


function formProcess( context, form , querypiece, fromdate, todate) {

    var theQuery = `Select
    '<a style="color:#0394fc;" href="https://4287944.app.netsuite.com/app/accounting/transactions/bintrnfr.nl?id=' || table1.id || '&whence=" >' || table1.tranid || '</a>' as Document_Number,
                    table1.trandate,
                    table1.time,
                    table1.user,
    '<a style="color:#0394fc;" href="https://4287944.app.netsuite.com/app/common/item/item.nl?id=' || table1.Item_ID || '" >' || table1.Item_Number || '</a>' as Item_Number,
                    table1.description,
   '<a style="color:#0394fc" href="https://4287944.app.netsuite.com/app/common/search/searchresults.nl?searchid=2114&InventoryBalance_BINNUMBER=' || table1.From_BinID || '" >' || table1.From_Bin || '</a>' as From_Bin,
                    ROUND(table2.quantity/table1.conversionrate, 4) || ' ' || table1.UM as Quantity_Transfered ,
   '<a style="color:#0394fc" href="https://4287944.app.netsuite.com/app/common/search/searchresults.nl?searchid=2114&InventoryBalance_BINNUMBER=' || table2.TO_BinID || '" >' || table2.TO_Bin || '</a>' as TO_BIN,
                    table1.Lot_Number
                    
                    
                    


                from (SELECT Transaction.id,
                    Transaction.tranid,
                    Transaction.trandate,
                    TO_CHAR(Transaction.trandate, 'HH24:MM') AS TIME,
                    BUILTIN.DF(Transaction.createdby) as User,
                    Transactionline.item as Item_ID,
                    BUILTIN.DF(Transactionline.item) as Item_Number,
                    BUILTIN.DF(Transaction.type) as type,
                    item.displayname as description,
                    Transactionline.id as translineid,
                    BUILTIN.DF(item.stockunit) as UM,
                    inventoryAssignment .quantity,
                    stockuom.conversionrate,
                    BUILTIN.DF(InventoryAssignment.inventorynumber) as Lot_Number,
                    inventoryAssignment.bin as From_BinID,
                    BUILTIN.DF(InventoryAssignment.bin) as From_Bin,
                    Transactionline.item as itinternalid,
                    InventoryAssignment.id as invid
                From Transaction
                Inner join Transactionline
                on Transactionline.transaction = Transaction.id
                LEFT JOIN 
                item on 
                item.id = Transactionline.item
                Left Join
                inventoryAssignment on
                transactionLine.id = inventoryAssignment.transactionline
                AND
                transactionLine.transaction = inventoryAssignment.transaction
                LEFT JOIN unitsTypeUom as stockuom
                on item.stockunit = stockuom.internalid 
                WHERE
                BUILTIN.DF(type) = 'Bin Transfer'
                AND
                Transactionline.isinventoryaffecting = 'T'
                AND
                Transaction.trandate Between TO_DATE('${fromdate}','MM/DD/YYYY')
                AND TO_DATE('${todate}','MM/DD/YYYY')
                AND
                InventoryAssignment.quantity < 0
                ORDER BY
                Transaction.Tranid) as table1
                LEFT JOIN
                (SELECT Transaction.tranid,
                    BUILTIN.DF(Transactionline.item),
                    BUILTIN.DF(Transaction.type) as type,
                    Transactionline.id as translineid,
                    Inventoryassignment.bin as To_BinID,
                    BUILTIN.DF(Inventoryassignment.bin) as To_Bin,
                    inventoryAssignment .quantity,
                    BUILTIN.DF(InventoryAssignment.inventorynumber),
                    InventoryAssignment.id as invid
                From Transaction
                Inner join Transactionline
                on Transactionline.transaction = Transaction.id
                Left Join
                inventoryAssignment on
                transactionLine.id = inventoryAssignment.transactionline
                AND
                transactionLine.transaction = inventoryAssignment.transaction
                WHERE
                BUILTIN.DF(type) = 'Bin Transfer'
                AND
                Transactionline.isinventoryaffecting = 'T'
                ORDER BY
                Transaction.Tranid) as table2
                on
                table1.invid = table2.invid - 1
                WHERE 1 = 1
                AND table2.quantity > 0
                
                ${querypiece}
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