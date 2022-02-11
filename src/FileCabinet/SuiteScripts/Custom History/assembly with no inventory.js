/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */



var
    log,
    query,
    serverWidget,
    historyRows = 1000;


define( [ 'N/log', 'N/query', 'N/ui/serverWidget', 'N/record', 'N/runtime' ], main );


function main( logModule, queryModule, serverWidgetModule , record, runtime) {

    // Set module references.
    log = logModule;
    query= queryModule;
    serverWidget = serverWidgetModule;

    return {

        onRequest: function( context ) {

            // Create a form.
            var form = serverWidget.createForm(
                {
                    title: 'Assembly With Empty Line Items',
                    hideNavBar: false
                }
            );

            form.addSubmitButton( { label: 'Run Report' } );


            var Item_Number = form.addField(
                {
                    id: 'item',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Item',
                    source: 'item'
                });

            var workorder = form.addField(
                {
                    id: 'workorder',
                    type: 'select',
                    source: record.Type.WORK_ORDER,
                    label: 'Work Order'
                }
            )


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

                if ((new Date(context.request.parameters.fromdate) < new Date('01/01/22')) && !context.request.parameters.force){
                    var errorfield = form.addField(
                        {
                            id:'error',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Error'
                        }
                    )


                    errorfield.defaultValue = `<script>alert('Yield report only works from 2022 onward')</script>`
                    context.response.writePage( form );
                    return
                }



                if ((new Date(context.request.parameters.fromdate) < new Date('6/26/21')) && !context.request.parameters.force){
                    var errorfield = form.addField(
                        {
                            id:'error',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Error'
                        }
                    )

                    errorfield.defaultValue = `<script>alert('Yield report only works from 2022 onward')</script>`
                } 

                log.debug(new Date(context.request.parameters.fromdate), new Date())

                var querypiece = ''

                if (context.request.parameters.item){
                    querypiece += `AND transactionline.item = ${context.request.parameters.item}`
                }

                if (context.request.parameters.workorder){
                    querypiece += `AND transactionline.createdfrom = ${context.request.parameters.workorder}`
                }

                var dtodate = formatdate(new Date)
                var dfromdate = new Date()
                dfromdate.setDate(dfromdate.getDate() - 7)
                dfromdate = formatdate(dfromdate)

                To_Date.defaultValue = context.request.parameters.todate || dtodate
                From_Date.defaultValue = context.request.parameters.fromdate || dfromdate

                Item_Number.defaultValue = context.request.parameters.item

                log.debug('fromdate', context.request.parameters.fromdate)
                log.debug('todate',  context.request.parameters.todate)


                if(!(new Date(context.request.parameters.fromdate) < new Date('6/26/21')) || runtime.getCurrentUser().id==28){
                    formProcess( context, form ,querypiece, context.request.parameters.fromdate || dfromdate, context.request.parameters.todate || dtodate);
                }

            }else{
                To_Date.defaultValue = new Date
                From_Date.defaultValue = new Date
            }

            // Display the form.
            context.response.writePage( form );

        }

    }

}


function formProcess( context, form , querypiece, fromdate, todate) {

    var theQuery = `
    SELECT
    transaction.tranid,
    BUILTIN.DF(transactionline.createdfrom) as work_order,
    BUILTIN.DF(transactionline.item) as item,
    '<a target="_blank" href="/app/common/custom/custrecordentry.nl?rectype=614&id=' ||  CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_workid || '" >' || CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_workid || '</a>' as workid,
    CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_reporteddate as reported_date
  FROM
    transaction
    INNER JOIN transactionline ON transactionline.transaction = transaction.id
    INNER JOIN  CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING on custrecord_mfgmob_prod_transactionrefno  = transaction.id
  WHERE
    transaction.type = 'Build'
    and transactionline.quantity = 0
    and CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_reporteddate between TO_DATE('${fromdate}') and TO_DATE('${todate}')
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


function sameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}