/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/query'],
    /**
 * @param{query} query
 */
    (query) => {

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            var rec = scriptContext.newRecord
            var item = scriptContext.getValue("custrecord_ppg_item")
            var date = scriptContext.getValue("custrecord_ppg_date")
            getItemDayRecords(item, date).forEach(x => {
                record.delete({
                    type: 'customrecord_planned_production',
                    id: x.id
                })
            })
        }


        function getItemDayRecords(item, date){
            var formatteddate = formatdate(date)
            var theQuery = `
            SELECT id from customrecord_cc_planned_production
            where custrecord_ppg_item = ${item}
            and custrecord_ppg_date = ${formatteddate}
            `

            return query.runSuiteQL(theQuery).asMappedResults()

        }


        function formatdate(date) {
            var d = new Date(date)

            var mm = d.getMonth() + 1
            var dd = d.getDate()
            var yyyy = d.getFullYear()

            if (mm < 10) {
                mm = "0" + mm
            }
            if (dd < 10) {
                dd = "0" + dd
            }

            return mm + "/" + dd + "/" + yyyy

        }



        return {beforeSubmit}

    });
