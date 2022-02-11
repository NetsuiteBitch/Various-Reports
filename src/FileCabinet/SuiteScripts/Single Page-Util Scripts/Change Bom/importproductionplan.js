/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/file', 'N/query', 'N/record', 'N/ui/serverWidget', 'N/redirect','N/runtime'],
    /**
     * @param{file} file
     * @param{query} query
     * @param{record} record
     */
    (file, query, record, serverWidget, redirect,runtime) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            if (scriptContext.request.method == "GET") {

                var form = serverWidget.createForm({
                    title: "Production Plan Import",
                })

                form.addSubmitButton({
                    label: "Import"
                })


                var filefield = form.addField({
                    id: "csvfile",
                    type: serverWidget.FieldType.FILE,
                    label: "Select File"
                })


                filefield.isMandatory = true

                scriptContext.response.writePage(form)
            }

            if (scriptContext.request.method == "POST") {
                var fileobj = scriptContext.request.files.csvfile
                var csvarr = fileobj.getContents().split("\n").map(x => CSVtoArray(x))
                var theQuery = `SELECT id from 
                CUSTOMRECORD_CC_PLANNED_PRODUCTION
                `

            }

            function CSVtoArray(text) {
                var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
                var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;

                // Return NULL if input string is not well formed CSV string.
                if (!re_valid.test(text)) return null;

                var a = []; // Initialize array to receive values.
                text.replace(re_value, // "Walk" the string using replace with callback.
                    function (m0, m1, m2, m3) {

                        // Remove backslash from \' in single quoted values.
                        if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));

                        // Remove backslash from \" in double quoted values.
                        else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
                        else if (m3 !== undefined) a.push(m3);
                        return ''; // Return empty string.
                    });

                // Handle special case of empty last value.
                if (/,\s*$/.test(text)) a.push('');
                return a;
            };
        }

        return {onRequest}

    });
