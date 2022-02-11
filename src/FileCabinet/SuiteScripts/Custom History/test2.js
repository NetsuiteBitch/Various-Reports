/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/query', 'N/record', 'N/search'],
    /**
 * @param{query} query
 * @param{record} record
 * @param{search} search
 */
    (query, record, search) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var theQuery = `select item.itemid, item.displayname from item where rownum < 20`
            log.debug('theQuery', theQuery)
            var results = query.runSuiteQL(theQuery).asMappedResults()
            log.debug('results', results)

            scriptContext.response.write("hello")

        }

        return {onRequest}

    });
