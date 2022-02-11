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

  


    function saveRecord(scriptContext) {
        var confirmchecked = scriptContext.currentRecord.getValue({fieldId: 'confirm'});
        console.log('confirmchecked: ' + confirmchecked);

        if(!confirmchecked) {
            alert('Please confirm the change');
            return false;
        }

        return true
    }





    return {
        pageInit: pageInit,
        saveRecord: saveRecord
    };
    
});
