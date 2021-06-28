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


define( [ 'N/log', 'N/query', 'N/ui/serverWidget', 'N/search', 'N/runtime' ], main );


function main( logModule, queryModule, serverWidgetModule , search, runtime) {

    // Set module references.
    log = logModule;
    query= queryModule;
    serverWidget = serverWidgetModule;

    return {

        onRequest: function( context ) {

            // Create a form.
            var form = serverWidget.createForm(
                {
                    title: 'Yield Report',
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

            var workid = form.addField(
                {
                    id: 'workid',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Work ID'
                }
            )

            var Processed = form.addField({
                id:'processed',
                type: serverWidget.FieldType.CHECKBOX,
                label:'Show Unprocessed'
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






            log.debug(context.request.parameters.force)
            log.debug("yay")

            // If the form has been submitted...
            if ( context.request.method == 'POST' || context.request.parameters.force) {


                if ((new Date(context.request.parameters.fromdate) < new Date('6/26/21')) && !context.request.parameters.force){
                    var errorfield = form.addField(
                        {
                            id:'error',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Error'
                        }
                    )

                    errorfield.defaultValue = `<script>alert('Yield report only works from 6/26 onward')</script>`
                }

                log.debug(new Date(context.request.parameters.fromdate), new Date())
                if ((sameDay(new Date(context.request.parameters.todate),  new Date())) && !context.request.parameters.force){
                    var errorfield2 = form.addField(
                        {
                            id:'error2',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Error'
                        }
                    )

                    errorfield2.defaultValue = `<script>alert('Yield report may be innacurate for todays values')</script>`
                }



                var querypiece = ''

                if (context.request.parameters.item){
                    querypiece += `AND CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_item = ${context.request.parameters.item}`
                }

                if (context.request.parameters.workid){
                    querypiece += `AND CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_workid = ${context.request.parameters.workid}`
                }

                var processedpiece = ''

                log.debug('p',context.request.parameters.processed)
                if (context.request.parameters.processed == 'F'){
                    processedpiece += `WHERE BUILTIN.DF(CUSTOMRECORD_MFGMOB_WORKWORKORDERDETAILS.custrecord_mfgmob_worktranstatus)	in ('Completed','Partially Built')`
                }

                var dtodate = formatdate(new Date)
                var dfromdate = new Date()
                dfromdate.setMonth(dfromdate.getMonth()-1)
                dfromdate = formatdate(dfromdate)

                To_Date.defaultValue = context.request.parameters.todate || dtodate
                From_Date.defaultValue = context.request.parameters.fromdate || dfromdate

                Item_Number.defaultValue = context.request.parameters.item

                log.debug(runtime.getCurrentUser().id)
                if(!(new Date(context.request.parameters.fromdate) < new Date('6/26/21')) || runtime.getCurrentUser().id==28){
                    formProcess( context, form ,querypiece, context.request.parameters.item, context.request.parameters.fromdate || dfromdate, context.request.parameters.todate || dtodate,processedpiece);
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


function formProcess( context, form , querypiece, item, fromdate, todate, processedpiece) {

    var theQuery = `
 SELECT Transaction.Tranid as DOCUMENT_NUMBER,
	'<a style="color: #3366BB;" href="https://4287944.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=614&id=' || CONSUMEPRODDETAIL.RM_WORK_ID || '" >' || CONSUMEPRODDETAIL.RM_WORK_ID || '</a>' as WORK_ID,
	CONSUMEPRODDETAIL.RM_ITEM as ITEM_NUMBER,
	CONSUMEPRODDETAIL.RM_QTY * CONSUMEUM.conversionrate as USED_QTY,
    ( bomRevisionComponentMember.quantity * unitstypeuom.conversionrate * Consumeproddetail.as_qty ) * CONSUMEUM.conversionrate as BOM_QTY,
     CONCAT( ROUND( ( ( ( CONSUMEPRODDETAIL.RM_QTY * CONSUMEUM.conversionrate ) /( ( bomRevisionComponentMember.quantity * unitstypeuom.conversionrate * Consumeproddetail.as_qty ) * CONSUMEUM.conversionrate ) ) -1 ) * 100, 0 ), '%' ) as PERCENT_OFF,
	BUILTIN.DF(CUSTOMRECORD_MFGMOB_WORKWORKORDERDETAILS.custrecord_mfgmob_worktranstatus),
	CONSUMEPRODDETAIL.RM_SHIFT as SHIFT
FROM (
		SELECT *
		FROM (
				SELECT CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_workid AS RM_WORK_ID,
					CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_item AS RM_ITEM_ID,
					BUILTIN.DF( CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_item ) AS RM_ITEM,
					SUM( CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_consumedquantity ) * unitstypeuom.conversionrate AS RM_QTY, 
                    MIN(CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_shift) AS RM_SHIFT
                    
				FROM CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION
					INNER JOIN Transactionline ON CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_workorder = Transactionline.transaction
					AND CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_item = Transactionline.item
					INNER JOIN ITEM ON Transactionline.item = Item.id
					INNER JOIN UNITSTYPE ON item.unitstype = unitstype.id
					INNER JOIN unitsTypeUom ON Unitstype.id = unitstypeuom.unitstype
					AND transactionline.units = unitstypeuom.internalid
				
				WHERE 1 = 1
				${querypiece}
				AND CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_consumeddate	
                Between TO_DATE('${fromdate}','MM/DD/YYYY')
                AND TO_DATE('${todate}','MM/DD/YYYY')				
				
				
				GROUP BY CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_workid,
					BUILTIN.DF(
						CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_item
					),
					CUSTOMRECORD_MFGMOB_MATERIALCONSUMPTION.custrecord_mfgmob_cons_item,
					Unitstypeuom.conversionrate
					
			) AS CONSUMPTIONDETAILS
			INNER JOIN (
				SELECT CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_workid AS AS_WORK_ID,
					CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_assemblyitem AS AS_ITEM_ID,
					BUILTIN.DF(
						CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_assemblyitem
					) AS AS_ITEM,
					SUM(
						CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_prodquantity
					) AS AS_QTY
				FROM CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING
				GROUP BY CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_workid,
					CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_assemblyitem,
					BUILTIN.DF(
						CUSTOMRECORD_MFGMOB_PRODUCTIONREPORTING.custrecord_mfgmob_prod_assemblyitem
					)
			) AS PRODUCTIONDETAILS ON CONSUMPTIONDETAILS.RM_WORK_ID = PRODUCTIONDETAILS.AS_WORK_ID
	) AS CONSUMEPRODDETAIL
	INNER JOIN CUSTOMRECORD_MFGMOB_WORKWORKORDERDETAILS ON CONSUMEPRODDETAIL.RM_WORK_ID = CUSTOMRECORD_MFGMOB_WORKWORKORDERDETAILS.custrecord_mfgmob_workid
	INNER JOIN Transaction ON CUSTOMRECORD_MFGMOB_WORKWORKORDERDETAILS.custrecord_mfgmob_workworkorder = Transaction.id
	INNER JOIN bomRevision ON transaction.billofmaterialsrevision = bomRevision.id
	INNER JOIN bomRevisionComponentMember ON bomRevision.id = bomRevisionComponentMember.bomrevision
	AND bomrevisioncomponentmember.item = CONSUMEPRODDETAIL.RM_ITEM_ID
	INNER JOIN unitstypeuom ON bomREvisionComponentmember.units = unitstypeuom.internalid
	INNER JOIN ITEM on CONSUMEPRODDETAIL.RM_ITEM_ID = ITEM.ID
	INNER JOIN unitstypeuom as consumeum on item.consumptionunit = consumeum.internalid
	${processedpiece}
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