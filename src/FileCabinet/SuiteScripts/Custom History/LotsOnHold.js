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
                    title: 'Lots on Hold Report',
                    hideNavBar: false
                }
            );

 
            formProcess(context, form);

            // Display the form.
            context.response.writePage( form );

        }

    }

}


function formProcess( context, form ) {

    var theQuery = `
    WITH all_lines AS (
        SELECT
          transactionline.item,
          inventoryassignment.inventorynumber,
          SUM(inventoryassignment.quantity) AS quantity
        FROM
          transaction
          INNER JOIN transactionline ON transactionline.transaction = transaction.id
          INNER JOIN inventoryassignment ON inventoryassignment.transactionline = transactionLine.id
          AND inventoryAssignment.transaction = transactionLine.transaction
        WHERE
          transaction.type IN (
            'BinTrnfr',
            'Build',
            'InvAdjst',
            'InvCount',
            'InvTrnfr',
            'ItemRcpt',
            'StatChng',
            'VendBill'
          )
          AND transactionline.isinventoryaffecting = 'T'
          AND inventoryassignment.inventorystatus = 2
        GROUP BY
          transactionline.item,
          inventoryassignment.inventorynumber
        HAVING
          SUM(inventoryassignment.quantity) > 0
      ),
      latest_comment AS (
        SELECT
          transaction.id AS transaction,
          transactionline.item,
          inventoryassignment.inventorynumber,
          transaction.memo,
          transaction.createddate,
          ROW_NUMBER() OVER (
            PARTITION BY transactionline.item,
            INventoryassignment.inventorynumber
            ORDER BY
              transaction.createddate
          ) AS recent_num
        FROM
          transaction
          INNER JOIN transactionline ON transactionline.transaction = transaction.id
          INNER JOIN inventoryassignment ON inventoryassignment.transactionline = transactionLine.id
          AND inventoryAssignment.transaction = transactionLine.transaction
        WHERE
          transaction.type = 'StatChng'
          AND inventoryAssignment.inventorystatus = 2
          AND transactionline.quantity > 0
      )
      SELECT
        '<a target="_blank" href="/app/accounting/transactions/statchng.nl?id=' || ltransaction.id || '" >' || ltransaction.tranid || '</ a>' as link,

        BUILTIN.DF(ltransaction.createdby) AS EMP,
        ltransaction.trandate as date,
        item.itemid as "Item #",
        item.displayname as "Description",
        lotnum.inventorynumber as "Lot",
        all_lines.quantity / suom.conversionrate AS quantity,
        suom.unitname as units,
        latest_comment.memo
      FROM
        all_lines
        INNER JOIN item ON item.id = all_lines.item
        INNER JOIN inventorynumber AS lotnum ON lotnum.id = all_lines.inventorynumber
        INNER JOIN unitstypeuom AS suom ON suom.internalid = item.stockunit
        LEFT JOIN latest_comment ON latest_comment.item = item.id
        AND latest_comment.recent_num = 1
        AND latest_comment.inventorynumber = all_lines.inventorynumber
        LEFT JOIN transaction AS ltransaction ON latest_comment.transaction = ltransaction.id`

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
                    label : 'Lots',
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
            jsField.defaultValue = '';

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