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


define(['N/log', 'N/query', 'N/ui/serverWidget', 'N/search'], main);


function main(logModule, queryModule, serverWidgetModule, search) {

    // Set module references.
    log = logModule;
    query = queryModule;
    serverWidget = serverWidgetModule;

    return {

        onRequest: function (context) {

            // Create a form.
            var form = serverWidget.createForm(
                {
                    title: 'Sales Availability Report V2',
                    hideNavBar: false
                }
            );

            form.addSubmitButton({ label: 'Run' });


            //add from date field

            var toDate = form.addField({
                id: 'custpage_to_date',
                type: serverWidget.FieldType.DATE,
                label: 'Run Until'
            });

            var Item = form.addField({
                id: 'custpage_item',
                type: serverWidget.FieldType.SELECT,
                label: 'Item',
                source: 'assemblyitem'
            });


            var OnlyShortages = form.addField({
                id: 'custpage_only_shortages',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Only Shortages'
            });




            //make to date required
            toDate.isMandatory = true;


            // If the form has been submitted...
            if (context.request.method == 'POST') {
                // Get the form parameters.
                var toDate = context.request.parameters.custpage_to_date;
                toDate = formatdate(toDate);

                    

                var item = context.request.parameters.custpage_item;
                var itempiece = item ? 'And Item.id = ' + item : '';

                formProcess(context, form, toDate, itempiece, context.request.parameters.custpage_only_shortages == 'T');

            }

            // Display the form.
            context.response.writePage(form);

        }

    }

}


function formProcess(context, form, toDate, itempiece, onlyshortages) {

    var theQuery = `
    WITH SalesOrderLines AS (
        SELECT
          transaction.tranid,
          transaction.id AS traniid,
          transaction.shipdate,
          BUILTIN.DF(transaction.entity) AS customer,
          BUILTIN.DF(transactionline.item) AS itemid,
          transactionline.item AS itemiid,
          item.displayname AS description,
          transactionline.quantity * -1 AS salesquantity,
          SUM(transactionline.quantity * -1) OVER (
            PARTITION BY transactionline.item
            ORDER BY
              transaction.shipdate,
              transaction.tranid,
              transactionline.linesequencenumber
          ) AS runningtotalneededbothlocations,
          SUM(transactionline.quantity * -1) OVER (
            PARTITION BY transactionline.item,
            transaction.location
            ORDER BY
              transaction.shipdate,
              transaction.tranid,
              transactionline.linesequencenumber
          ) AS runningtotalneededeachlocations,
          transactionline.location AS lid,
          BUILTIN.DF(transactionline.location) AS location
        FROM
          transaction
          INNER JOIN transactionline ON transactionline.transaction = transaction.id
          INNER JOIN item ON item.id = transactionline.item
        WHERE
          transaction.type = 'SalesOrd'
          AND transaction.shipdate Between Sysdate and  TO_DATE('${toDate}')
          AND item.itemtype = 'Assembly'
          AND transactionline.rate ! = 0
          ${itempiece}
        ORDER BY
          transactionline.item,
          transaction.shipdate
      ),
      quantitywithoutblastchiller AS (
        SELECT
          item.itemid,
          item.id AS itemiid,
          SUM(
            (
              InventoryNumberLocation.quantityonhand + InventoryNumberLocation.quantityintransit
            )
          ) - MIN(COALESCE(itembinquantity.onhand, 0)) AS qtyonhand,
          InventoryNumberLocation.location
        FROM
          inventorynumber
          INNER JOIN item ON inventoryNumber.item = item.id
          INNER JOIN InventoryNumberLocation ON InventoryNumberLocation.inventorynumber = inventorynumber.id
          LEFT JOIN itembinquantity ON BUILTIN.DF(itembinquantity.bin) = 'Blast Chiller'
          AND itembinquantity.item = item.id
          AND InventoryNumberLocation.location = 5
        WHERE
          InventoryNumberLocation.quantityonhand > 0
          AND item.itemtype = 'Assembly'
        GROUP BY
          item.itemid,
          item.id,
          InventoryNumberLocation.location
      ),
      combinedinventory AS (
        SELECT
          itemiid,
          SUM(qtyonhand) AS qtyonhand
        FROM
          quantitywithoutblastchiller
        --WHERE location not in (118)
        GROUP BY
          itemiid
      ),
      productionplan AS (
        SELECT
          custrecord_ppd_item,
          custrecord_ppd_date,
          custrecord_ppd_quantity,
          SUM(custrecord_ppd_quantity) OVER (
            PARTITION BY custrecord_ppd_item
            ORDER BY
              custrecord_ppd_date
          ) AS running_production_total
        FROM
          CUSTOMRECORD_CC_PLANNED_PRODUCTION
          WHERE custrecord_ppd_date > SYSDATE
        ORDER BY
          custrecord_ppd_item,
          custrecord_ppd_date
      ),
      Salesorderlineswproduction AS (
        SELECT
          SalesOrderLines.tranid,
          SalesOrderLines.customer,
          SalesOrderLines.itemiid,
          SalesOrderLines.location,
          SalesOrderLines.lid,
          SalesOrderLines.description,
          SalesOrderLines.shipdate,
          SalesOrderLines.itemid,
          SalesOrderLines.salesquantity,
          SalesOrderLines.runningtotalneededeachlocations,
          SalesOrderLines.runningtotalneededbothlocations,
          COALESCE(MAX(productionplan.running_production_total), 0) AS runningproductiontotal
        FROM
          salesorderlines
          LEFT JOIN productionplan ON productionplan.custrecord_ppd_item = SalesOrderLines.itemiid
          AND productionplan.custrecord_ppd_date <= salesorderlines.shipdate
        GROUP BY
          SalesOrderLines.tranid,
          SalesOrderLines.customer,
          SalesOrderLines.lid,
          SalesOrderLines.itemiid,
          SalesOrderLines.description,
          SalesOrderLines.location,
          SalesOrderLines.shipdate,
          SalesOrderLines.itemid,
          SalesOrderLines.salesquantity,
          SalesOrderLines.runningtotalneededeachlocations,
          SalesOrderLines.runningtotalneededbothlocations
      )
      SELECT
        salesorderlineswproduction.tranid as "Sales Order #",
        salesorderlineswproduction.customer,
        salesorderlineswproduction.location,
        salesorderlineswproduction.shipdate as "Ship Date",
        salesorderlineswproduction.itemid || ': ' || salesorderlineswproduction.description as "Item",
        salesorderlineswproduction.salesquantity as quantity,
        salesorderlineswproduction.runningtotalneededeachlocations as "Running Total Needed Specific Location",
        salesorderlineswproduction.runningtotalneededbothlocations as "Running Total Needed",
        salesorderlineswproduction.runningproductiontotal as "Running Production",
        quantitywithoutblastchiller.qtyonhand as "Inventory This Location",
        combinedinventory.qtyonhand as "Inventory Both Locations",
        --salesorderlineswproduction.runningproductiontotal + COALESCE(combinedinventory.qtyonhand, 0) - salesorderlineswproduction.runningtotalneededbothlocations as "Projected Inventory",
        CASE WHEN (
        COALESCE(quantitywithoutblastchiller.qtyonhand, 0) - salesorderlineswproduction.runningtotalneededeachlocations < 0
        and 
        salesorderlineswproduction.runningproductiontotal + COALESCE(combinedinventory.qtyonhand, 0) - salesorderlineswproduction.runningtotalneededbothlocations  > 0
        and 
        salesorderlineswproduction.lid != 5) then '•'
        else '' 
        end  ||  TO_CHAR(salesorderlineswproduction.runningproductiontotal + COALESCE(combinedinventory.qtyonhand, 0) - salesorderlineswproduction.runningtotalneededbothlocations) as "Projected Inventory",
        COALESCE(quantitywithoutblastchiller.qtyonhand, 0) - salesorderlineswproduction.runningtotalneededeachlocations as "Projected Inventory Specific Location",
      FROM
        salesorderlineswproduction
        LEFT JOIN quantitywithoutblastchiller ON quantitywithoutblastchiller.itemiid = salesorderlineswproduction.itemiid
        AND salesorderlineswproduction.lid = quantitywithoutblastchiller.location
        LEFT JOIN combinedinventory ON combinedinventory.itemiid = salesorderlineswproduction.itemiid
            ORDER BY salesorderlineswproduction.itemid, salesorderlineswproduction.shipdate
    `
    log.debug("Query", theQuery)

    try {

        // Run the query.
        var queryResults = query.runSuiteQL(
            {
                query: theQuery
            }
        );

        // Get the mapped results.
        var records = queryResults.asMappedResults();
        if(onlyshortages) {
            records = records.filter(x => records.filter(x => x["projected inventory"] <= 0).map(x => x.item).includes(x.item))
        }

        // If records were returned...
        if (records.length > 0) {

            // Create a sublist for the results.
            var resultsSublist = form.addSublist(
                {
                    id: 'results_sublist',
                    label: 'Balance History',
                    type: serverWidget.SublistType.LIST
                }
            );

            // Get the column names.
            var columnNames = Object.keys(records[0]);

            // Loop over the column names...
            for (i = 0; i < columnNames.length; i++) {

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
            // for (r = 0; r < records.length; r++) {

            //     // Get the record.
            //     var record = records[r];

            //     // Loop over the columns...
            //     for (c = 0; c < columnNames.length; c++) {

            //         // Get the column name.
            //         var column = columnNames[c];

            //         // Get the column value.
            //         var value = record[column];

            //         // If the column has a value...
            //         if (value != null) {

            //             // Get the value as a string.
            //             value = value.toString();

            //             // If the value is too long to be displayed in the sublist...
            //             if (value.length > 300) {

            //                 // Truncate the value.
            //                 value = value.substring(0, 297) + '...';

            //             }

            //             // Add the column value.
            //             resultsSublist.setSublistValue(
            //                 {
            //                     id: 'custpage_results_sublist_col_' + c,
            //                     line: r,
            //                     value: value
            //                 }
            //             );

            //         }

            //     }

            // }

            // Add an inline HTML field so that JavaScript can be injected.
            var jsField = form.addField(
                {
                    id: 'custpage_field_js',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Javascript'
                }
            );

            // Add Javascript to make the first row bold, and add a tooltip.

            jsField.defaultValue = `
            <script type="text/javascript" src="https://code.jquery.com/jquery-3.5.1.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js" integrity="sha512-xQBQYt9UcgblF6aCMrwU1NkVA7HCXaSN2oq0so80KO+y68M+n64FOcqgav4igHe6D5ObBLIf68DWv+gfBowczg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <link id="datagridstyle" href="https://cdnjs.cloudflare.com/ajax/libs/devextreme/21.2.5/css/dx.material.blue.light.compact.css" rel="stylesheet">
            <script src="https://cdnjs.cloudflare.com/ajax/libs/devextreme/21.2.5/js/dx.all.js"></script>
            <script>
            var results = ${JSON.stringify(records)};
            $(document).ready(function() {

                $(function () {
                    $("#results_sublist_splits").dxDataGrid({
                        dataSource: results,
                        searchPanel: { visible: true },
                        filterRow: {
                        visible: true,
                        applyFilter: 'auto',
                        },
                        export: {
                            enabled: true,
                            fileName: 'Sales Report'
                        },
                        columnAutoWidth: true, columnChooser: {
                            enabled: true,
                            mode: "dragAndDrop" // or "select"
                        },
                        headerFilter: {
                            visible: true,
                            allowSearch: true
                        },
                        grouping: {
                            contextMenuEnabled: true
                        },
                        groupPanel: {
                            visible: true   // or "auto"
                        },
                        paging: {
                            pageSize: 25,
                
                        },
                        pager: {
                            showPageSizeSelector: true,
                            allowedPageSizes: [25, 50, 100, results.length],
                        },
                        columns:
                            [
                                {
                                    dataField: "sales order #"
                                },
                                {
                                    dataField: "customer"
                                },
                                {
                                    dataField: "location",
                                    dataType: "text"
                                },
                
                                { 
                                    dataField: "ship date",
                                    dataType: 'date',
                                    filterOperations: ['between', '<='],
                                    selectedFilterOperation: 'between',
                                    allowHeaderFiltering: false,
                                    calculateGroupValue: function (rowData) {
                                        var shipDate = rowData['ship date'];
                                        var d = new Date(shipDate);
                                        var sunday = new Date(d.setDate(d.getDate() - d.getDay()));
                                        //format date
                                        var month = sunday.getMonth() + 1;
                                        var day = sunday.getDate();
                                        var year = sunday.getFullYear();
                                        var formattedDate = month + "/" + day + "/" + year;
                                        return "Week of "  + formattedDate;
                                    }

                                },
                                {
                                    dataField: "item",
                                    groupIndex: 0,
                                    headerFilter: {
                                        width: "auto"
                                    }
                                 },
                                { 
                                    dataField: "quantity",
                                    dataType: 'number',
                                    allowHeaderFiltering: false,
                                    allowFiltering: false
                                },
                                {
                                    dataField: "running total needed specific location",
                                    visible:false,
                                    dataType: 'number',
                                    allowHeaderFiltering: false,
                                    allowFiltering: false
                                },
                                {
                                    dataField: "running total needed",
                                    allowHeaderFiltering: false,
                                    allowFiltering: false
                                },
                                {
                                    dataField: "running production",
                                    allowHeaderFiltering: false,
                                    allowFiltering: false
                                },
                                { 
                                    dataField: "projected inventory",
                                    alignment: "right",
                                    dataType: 'number',
                                    selectedFilterOperation: "<",
                                    allowHeaderFiltering: false
                                },
                                {
                                    dataField: "projected inventory specific location",
                                    visible:false,
                                    selectedFilterOperation: "<",
                                    allowHeaderFiltering: false
                                },
                                {
                                    dataField: "inventory this location",
                                    visible:false,
                                    allowFiltering: false,
                                    allowHeaderFiltering: false
                                },
                                {
                                    dataField: "inventory both locations",
                                    visible:false,
                                    allowFiltering: false,
                                    allowHeaderFiltering: false
                                }
                            ]
                
                    });
                });
                




            })
            </script>
            `;

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

        }

    } catch (e) {

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

function formatdate(jsdate) {
    jsdate = new Date(jsdate);
    var dd = String(jsdate.getDate()).padStart(2, '0');
    var mm = String(jsdate.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = jsdate.getFullYear();
    return mm + '/' + dd + '/' + yyyy;
}


// $(function () {
//     $("#results_sublist_splits").dxDataGrid({
//         dataSource: results,
//         searchPanel: { visible: true },
//         filterRow: {
//         visible: true,
//         cellHintEnabled: true,
//         applyFilter: 'auto',
//         },
//         columnAutoWidth: true, columnChooser: {
//             enabled: true,
//             mode: "dragAndDrop" // or "select"
//         },
//         headerFilter: {
//             visible: true,
//             allowSearch: true
//         },
//         grouping: {
//             contextMenuEnabled: true
//         },
//         groupPanel: {
//             visible: true   // or "auto"
//         },
//         paging: {
//             pageSize: 25,

//         },
//         pager: {
//             showPageSizeSelector: true,
//             allowedPageSizes: [25, 50, 100, results.length],
//         },
//         columns:
//             [
//                 {
//                     dataField: "sales order #"
//                 },
//                 {
//                     dataField: "customer"
//                 },
//                 {
//                     dataField: "location",
//                     dataType: "text"
//                 },

//                 { 
//                     dataField: "ship date",
//                     dataType: 'date',
//                     filterOperations: ['between', '<='],
//                     selectedFilterOperation: 'between',
//                     allowHeaderFiltering: false
//                 },
//                 {
//                     dataField: "item",
//                     groupIndex: 0,
//                     headerFilter: {
//                         width: "auto"
//                     }
//                  },
//                 { 
//                     dataField: "quantity",
//                     dataType: 'number',
//                     allowHeaderFiltering: false,
//                     allowFiltering: false
//                 },
//                 {
//                     dataField: "running total needed specific location",
//                     visible:false,
//                     dataType: 'number',
//                     allowHeaderFiltering: false,
//                     allowFiltering: false
//                 },
//                 {
//                     dataField: "running total needed",
//                     allowHeaderFiltering: false,
//                     allowFiltering: false
//                 },
//                 {
//                     dataField: "running production",
//                     allowHeaderFiltering: false,
//                     allowFiltering: false
//                 },
//                 { 
//                     dataField: "projected inventory",
//                     alignment: "right",
//                     dataType: 'number',
//                     selectedFilterOperation: "<",
//                     allowHeaderFiltering: false
//                 },
//                 {
//                     dataField: "Projected Inventory Specific Location",
//                     visible:false,
//                     selectedFilterOperation: "<",
//                     allowHeaderFiltering: false
//                 }
//             ]

//     });
// });


