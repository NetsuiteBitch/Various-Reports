/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/query', 'N/currentRecord'],
    /**
     * @param{search} search
     */
    function (search, query, currentRecord) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext) {
            var rec = currentRecord.get()
            var customer = rec.getValue('entity')
            var entityclass = getclassfromentity(customer)
            if (entityclass && customer) {
                console.log('entityclass: ' + entityclass)
                scriptContext.currentRecord.setValue({
                    fieldId: 'class',
                    value: entityclass
                })

                var linecount = rec.getLineCount({ sublistId: 'item' })
                for (var i = 0; i < linecount; i++) {
                    rec.selectLine({
                        sublistId: 'item',
                        line: i
                    })

                    rec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'class',
                        line: i,
                        value: entityclass
                    })

                    rec.commitLine({ sublistId: 'item' })
                }
            }
        }


        /**
         * Function to be executed when field is slaved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         *
         * @since 2015.2
         */

        function postSourcing(scriptContext) {

            if (scriptContext.sublistId == 'expense') {
                currentRecord.get().cancelLine({
                    sublistId: 'item'
                })
            }


            if (scriptContext.fieldId == 'entity') {
                var entity = scriptContext.currentRecord.getValue({
                    fieldId: 'entity'
                });

                var entityclass = getclassfromentity(entity)
                if (entityclass) {
                    scriptContext.currentRecord.setValue({
                        fieldId: 'class',
                        value: entityclass
                    });
                }
            }


            if (scriptContext.sublistId) {

                var rec = scriptContext.currentRecord;
                var classid = rec.getValue({
                    fieldId: 'class'
                })

                if (classid) {
                    try {
                        scriptContext.currentRecord.setCurrentSublistValue({
                            sublistId: scriptContext.sublistId,
                            fieldId: 'class',
                            value: classid
                        })

                    } catch (error) {
                        console.log(error);
                    }
                }
            }
        }



        /**
     * Function to be executed after line is selected.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @since 2015.2
     */
        function lineInit(scriptContext) {

        }


        function getclassfromentity(id) {
            if (!id) return null

            var theQuery = `WITH classes AS (
            SELECT
                id,
                custentity_cc_customer_class
            FROM
                customer
            UNION ALL
            SELECT
                id,
                custentity_cc_customer_class
            FROM
                vendor
            )
            SELECT
            custentity_cc_customer_class
            FROM
            classes
            WHERE
            id = ${id}`;

            return query.runSuiteQL(theQuery).asMappedResults()[0]?.custentity_cc_customer_class;

        }





        return {
            pageInit: pageInit,
            postSourcing: postSourcing,
            lineInit: lineInit
        };

    });