/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

formulaworkcenter = 1886
spiceworkcenter = 2211
packagingworkcenter = 1444

define(['N/query', 'N/ui/serverWidget', '/SuiteScripts/Ing Usage/Ing Usage Utils.js'],
    /**
     * @param{query} query
     */
    (query, serverWidget, ingUtils) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var form = serverWidget.createForm({
                title: 'Ingredient Usage By Day'
            })

            var fromdate = form.addField({
                type: serverWidget.FieldType.DATE,
                id: 'fromdate',
                label: 'From Date'
            })

            fromdate.isMandatory = true

            var todate = form.addField({
                type: serverWidget.FieldType.DATE,
                id: 'todate',
                label: 'To Date'
            })


            form.addSubmitButton()

            if (scriptContext.request.method == 'POST') {

                var fromdate  = scriptContext.request.parameters.fromdate
                var todate =   scriptContext.request.parameters.todate || fromdate
                var datesarr = ingUtils.getdatesbetween(fromdate, todate).map(x => ingUtils.formatdayddmmyyyy(x))

                var toplevelusage = ingUtils.getitemusage(fromdate, todate, packagingworkcenter)

                form.addSubtab({
                    id: 'fgresults',
                    label: 'Packaging'
                })

                form.addSubtab({
                    id: 'formulatab',
                    label: 'Formula'
                })

                form.addSubtab({
                    id: 'spicetab',
                    label: 'Spices'
                })

                toplevelusage = toplevelusage.filter(x => datesarr.includes(x.day))
                var alltoplevelitems = [...new Set(toplevelusage.map(x => x.bomitem))]

                var toplevelmap = ingUtils.createmap(toplevelusage, alltoplevelitems, datesarr)

                var toplevelsublist = form.addSublist({
                    id: 'fgsublist',
                    label: 'Packaging',
                    type: serverWidget.SublistType.LIST,
                    tab: 'fgresults'
                })

                toplevelsublist.addField({
                    id: 'bomitem',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item'
                })


                toplevelsublist.addField({
                    id: 'description',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Description'
                })

                datesarr.forEach(x => {
                    toplevelsublist.addField({
                        id: x.replace(/\//g,''),
                        label: x,
                        type: serverWidget.FieldType.FLOAT
                    })
                })

                toplevelsublist.addField({
                    id: 'units',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Units'
                })

                toplevelmap.forEach((x,i) => {
                    Object.keys(x).forEach(y => {
                        toplevelsublist.setSublistValue({
                            line: i,
                            id: y.replace(/\//g, ''),
                            value: x[y]
                        })
                    })
                })


                var formulausage = ingUtils.getitemusage(fromdate, todate, formulaworkcenter)
                formulausage = formulausage.filter(x => datesarr.includes(x.day))

                var allformulaitems = [...new Set(formulausage.map(x => x.bomitem))]

                var formulamap = ingUtils.createmap(formulausage, allformulaitems, datesarr)

                var formulalist = form.addSublist({
                    id: 'formulasublist',
                    label: 'Formula Sublist',
                    type: serverWidget.SublistType.LIST,
                    tab: 'formulatab'
                })

                formulalist.addField({
                    id: 'bomitem',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item'
                })


                formulalist.addField({
                    id: 'description',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Description'
                })


                datesarr.forEach(x => {
                    formulalist.addField({
                        id: x.replace(/\//g,''),
                        label: x,
                        type: serverWidget.FieldType.FLOAT
                    })
                })


                formulalist.addField({
                    id: 'units',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Units'
                })

                formulamap.forEach((x,i) => {
                    Object.keys(x).forEach(y => {
                        formulalist.setSublistValue({
                            line: i,
                            id: y.replace(/\//g, ''),
                            value: x[y]
                        })
                    })
                })



                var logging = form.addField({
                    label: 'logging',
                    id: 'logging',
                    type: serverWidget.FieldType.INLINEHTML
                })



                //spices 

                var spiceusage = ingUtils.getitemusage(fromdate, todate, spiceworkcenter)
                spiceusage = spiceusage.filter(x => datesarr.includes(x.day))

                var allspiceitems = [...new Set(spiceusage.map(x => x.bomitem))]

                var spicemap = ingUtils.createmap(spiceusage, allspiceitems, datesarr)

                var spicelist = form.addSublist({
                    id: 'spicesublist',
                    label: 'Spice Sublist',
                    type: serverWidget.SublistType.LIST,
                    tab: 'spicetab'
                })

                spicelist.addField({
                    id: 'bomitem',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item'
                })


                spicelist.addField({
                    id: 'description',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Description'
                })


                datesarr.forEach(x => {
                    spicelist.addField({
                        id: x.replace(/\//g,''),
                        label: x,
                        type: serverWidget.FieldType.FLOAT
                    })
                })


                spicelist.addField({
                    id: 'units',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Units'
                })

                spicemap.forEach((x,i) => {
                    Object.keys(x).forEach(y => {
                        spicelist.setSublistValue({
                            line: i,
                            id: y.replace(/\//g, ''),
                            value: x[y]
                        })
                    })
                })

                logging.defaultValue = `
                <script>
                console.log(${JSON.stringify(toplevelmap)})
                console.log(${JSON.stringify(toplevelusage)})
                console.log(${JSON.stringify(datesarr)})
                </script>
                `
            }
            scriptContext.response.writePage(form)

        }


        return {onRequest}

    });
