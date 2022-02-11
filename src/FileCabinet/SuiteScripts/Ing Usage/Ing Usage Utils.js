/**
 * @NApiVersion 2.1
 */
define(['N/query'],

    (query,) => {

        const getitemusage = (startdate, enddate, workcenter) => {
          var startdate = formatdayddmmyyyy(new Date(startdate))
          var enddate = formatdayddmmyyyy(new Date(enddate))
            var theQuery = `WITH ratios AS (
              SELECT
                CUSTOMRECORD_WOD.custrecord_wod_work_order AS work_order_id,
                CUSTOMRECORD_WOD.custrecord_wod_day AS wday,
                CUSTOMRECORD_WOD.custrecord_wod_quantity / SUM(CUSTOMRECORD_WOD.custrecord_wod_quantity) OVER (
                  PARTITION BY CUSTOMRECORD_WOD.custrecord_wod_work_order
                ) AS ratio
              FROM
                CUSTOMRECORD_WOD
                INNER JOIN transaction ON transaction.id = CUSTOMRECORD_WOD.custrecord_wod_work_order
              WHERE
                transaction.startdate BETWEEN '${startdate}' AND '${enddate}'
                AND transaction.custbody_mfgmob_workcenter = ${workcenter}
                AND CUSTOMRECORD_WOD.isinactive = 'F'
            )
            SELECT
              ratios.wday AS DAY,
              BUILTIN.DF(transactionline.item) AS bomitem,
              ROUND(SUM(
                transactionline.quantity * ratios.ratio / suom.conversionrate * -1
              ), 2) AS totalneeded,
              BUILTIN.DF(item.stockunit) AS unitname
            FROM
              transactionline
              INNER JOIN ratios ON ratios.work_order_id = transactionline.transaction
              INNER JOIN item ON item.id = transactionline.item
              INNER JOIN unitstypeuom AS suom ON suom.internalid = item.stockunit
            WHERE
              item.itemtype = 'InvtPart'
            GROUP BY
              ratios.wday,
              BUILTIN.DF(transactionline.item),
              BUILTIN.DF(item.stockunit)`
            return query.runSuiteQL(theQuery).asMappedResults()
        }

        function getdatesbetween(startdate, enddate) {
            var start = new Date(startdate)
            var end = new Date(enddate)
            var dates = []
            while (start <= end) {
                dates.push(new Date(start))
                start.setDate(start.getDate() + 1)
            }
            return dates
        }


        function formatdayddmmyyyy(date) {
            var d = new Date(date)
            var day = d.getDate()
            var month = d.getMonth() + 1
            var year = d.getFullYear()

            if (day < 10) {
                day = '0' + day
            }

            if (month < 10) {
                month = '0' + month
            }

            return month + '/' + day + '/' + year
        }


        function findvaluebydayanditem(usagearray, day, item) {
            var result = usagearray.filter(x => {
                return x.day == day && x.bomitem == item
            })
            return result[0]?.totalneeded || 0;
        }

        function createmap(usagearray, allitems, alldates) {
            var itemlookup = getitemlookup()
            var map = allitems.map(x => {
                var o = {};
                o.bomitem = x;
                o.units = itemlookup[o.bomitem]['units'];
                o.description = itemlookup[o.bomitem]['displayname'];
                alldates.forEach(y => {
                    o[y] = findvaluebydayanditem(usagearray, y, x);
                });
                return o
            })

            return map
        }

        function getitemlookup(){
            var results = query.runSuiteQL(`
            SELECT item.itemid, item.displayname, BUILTIN.DF(item.purchaseunit) as units from item
            `).asMappedResults()
            var lookup = {}
            results.forEach(x => lookup[x.itemid] = x)
            return lookup
        }




        return {
            formatdayddmmyyyy,
            getdatesbetween,
            findvaluebydayanditem,
            createmap,
            getitemusage
        }

    });
