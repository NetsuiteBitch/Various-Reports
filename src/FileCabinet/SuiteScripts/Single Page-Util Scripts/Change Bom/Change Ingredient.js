/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/query', 'N/record', 'N/ui/serverWidget'],

    /**
     * @param{query} query
     * @param{record} record
     */

    (query, record, serverWidget) => {

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            if(scriptContext.request.parameters.confirm == 'T') {
                checklistandchangeingredients(scriptContext.request);
            }

            const form = serverWidget.createForm({
                title: 'Change Ingredient'
            });


            var oldingredientfield = form.addField({
                id: 'old_ingredient',
                type: serverWidget.FieldType.SELECT,
                label: 'Old Ingredient',
                source: record.Type.INVENTORY_ITEM
            });

            var newingredientfield = form.addField({
                id: 'new_ingredient',
                type: serverWidget.FieldType.SELECT,
                label: 'New Ingredient',
                source: record.Type.INVENTORY_ITEM
            })



            if(scriptContext.request.method == 'GET') {

                form.clientScriptModulePath = './Change Ingredient Client Get.js';

                oldingredientfield.isMandatory = true;
                newingredientfield.isMandatory = true;

                form.addSubmitButton({label: 'Submit'})
            }



            if(scriptContext.request.method === 'POST') {
                form.clientScriptModulePath = './Change Ingredient Client Post.js';

                form.addSubmitButton({label: 'Submit'})

                newingredientfield.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});
                oldingredientfield.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});
                oldingredientfield.defaultValue = scriptContext.request.parameters.old_ingredient;
                newingredientfield.defaultValue = scriptContext.request.parameters.new_ingredient;

                var message = form.addField({
                    id: 'confirm_message',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Message'
                })

                message.defaultValue = `
                <div style="font-family: Roboto; font-size: 16pt">
                <p>Please tick the boms you wish to change the ingredient of</p>
                <p>make sure to check confirm box before submitting.</p>
                <p>Hit submit to change the ingredient.</p>
                <br>
                <div>
                `


                form.addField({
                    id: 'confirm',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Confirm'
                })




                var sublist = form.addSublist({
                    id: 'boms',
                    type: serverWidget.SublistType.LIST,
                    label: 'Bills of Materials'
                })



                sublist.addField({
                    id: 'change',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Change'
                })



                sublist.addField({
                    id: 'bom',
                    type: serverWidget.FieldType.SELECT,
                    label: 'BOM_REVISION',
                    source: record.Type.BOM_REVISION
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});

                sublist.addField({
                    id: 'quantity',
                    type: serverWidget.FieldType.FLOAT,
                    label: 'Quantity'
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});


                var unitsfield = sublist.addField({
                    id: 'units',
                    type: serverWidget.FieldType.TEXT,
                    label: 'UM'
                })



                unitsfield.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});


                sublist.addMarkAllButtons()

                var mysublist = form.getSublist({id: 'boms'})


                getallcurrentbomsforitem(scriptContext.request.parameters.old_ingredient).forEach(function(line, i) {


                    mysublist.setSublistValue({
                        id: 'bom',
                        line: i,
                        value: line.bom
                    })

                    mysublist.setSublistValue({
                        id: 'quantity',
                        line: i,
                        value: line.quantity
                    })

                    mysublist.setSublistValue({
                        id: 'units',
                        line: i,
                        value: line.units
                    })

                })


        }


        scriptContext.response.writePage(form)

        function checklistandchangeingredients(request) {

            var old_ingredient = request.parameters.old_ingredient
            var new_ingredient = request.parameters.new_ingredient

            var linecount = request.getLineCount('boms')

            for(var i = 0; i < linecount; i++) {
                var bomrevision = request.getSublistValue('boms', 'bom', i)

                var change = request.getSublistValue('boms', 'change', i)

                if(change == "T"){
                    changeingredientonbomrev(bomrevision, old_ingredient, new_ingredient)
                }

            }

        }


        function changeingredientonbomrev(bomrevid, old_ingredient, new_ingredient){


            var bomrev = record.load({
                type: 'bomrevision',
                id: parseInt(bomrevid),
                isDynamic: true
            })


            var itemlinenumber = bomrev.findSublistLineWithValue({
                sublistId: 'component',
                fieldId: 'item',
                value: old_ingredient
            })

            bomrev.selectLine({
                sublistId: 'component',
                line: itemlinenumber
            })

            bomrev.setCurrentSublistValue({
                sublistId: 'component',
                fieldId: 'item',
                value: new_ingredient
            })

            bomrev.commitLine({
                sublistId: 'component'
            })

            bomrev.save()
        }

        function getallcurrentbomsforitem(olditem) {
            var theQuery = `
            SELECT
            bomrevision.id as bom,
            bomrevisioncomponentmember.quantity,
            BUILTIN.DF(bomrevisioncomponentmember.units) as units
            FROM
            bomrevision
            INNER JOIN bomrevisioncomponentmember ON bomrevisioncomponentmember.bomrevision = bomrevision.id
            WHERE
            bomrevisioncomponentmember.item = ${olditem}
            AND sysdate BETWEEN bomrevision.effectivestartdate
            AND bomrevision.effectiveenddate
            and bomrevisioncomponentmember.units is not null
            and bomrevisioncomponentmember.quantity is not null
            `
            return query.runSuiteQL(theQuery).asMappedResults()
        }

    }

        return {onRequest}

    });
