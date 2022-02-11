/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/query', 'N/record', 'N/search'],
/**
 * @param{query} query
 * @param{record} record
 */
function(query, record, search) {
    



    function pageInit(scriptContext) {
    }

  


    /**
     * Validation function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @returns {boolean} Return true if field is valid
     *
     * @since 2015.2
     */
    function validateField(scriptContext) {


        if(scriptContext.fieldId == 'new_ingredient') {

            var newingredient = scriptContext.currentRecord.getValue({fieldId: 'new_ingredient'});

            console.log('newingredient: ' + newingredient);
            var oldingredient = scriptContext.currentRecord.getValue({fieldId: 'old_ingredient'});

            if(!oldingredient) {
                alert('Please select an old ingredient first');
                return false;
            }

            if(!areunitsequal(oldingredient, newingredient)) {
                alert('Old and new ingredient unitstype are not equal');
                return false;
            }

        }


        return true
    }


    function areunitsequal(old_ingredient, new_ingredient) {


        var old_unitstype =  search.lookupFields({
            type: 'inventoryitem',
            id: old_ingredient,
            columns: ['unitstype']
        }).unitstype[0].value

        var new_unitstype =  search.lookupFields({
            type: 'inventoryitem',
            id: new_ingredient,
            columns: ['unitstype']
        }).unitstype[0].value


        return old_unitstype == new_unitstype;
    }







    return {
        pageInit: pageInit,
        validateField: validateField
    };
    
});
