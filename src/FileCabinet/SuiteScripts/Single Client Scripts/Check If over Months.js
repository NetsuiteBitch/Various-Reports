/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/query', 'N/record'],
/**
 * @param{query} query
 * @param{record} record
 */
function(query, record) {
    
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

    }


    /**
     * Validation function to be executed when record is saved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     *
     * @since 2015.2
     */
    function saveRecord(scriptContext) {
        var invoiceperiod = scriptContext.currentRecord.getText({
            fieldId: 'postingperiod'
        });

        var createdfrom  = scriptContext.currentRecord.getValue({
            fieldId: 'createdfrom'
        });

        var ifperiod = get_ifdate_from_so_id(createdfrom)

        if(ifperiod == invoiceperiod){
            return true
        }else{
            alert(`Invoice period (${invoiceperiod}) is not the same as the Item Fullfilment period (${ifperiod})\n\nPlease correct the invoice period and try again.`)
            get_ifs_from_so_id(createdfrom).forEach(ifid => {
                window.open(`/app/accounting/transactions/itemship.nl?whence=&id=${ifid}&e=T`, 'ifwin', "popup")
            });

            return false

        }
    }


    function get_ifdate_from_so_id(so_id) {
        var theQuery = `
        SELECT
        BUILTIN.DF(transaction.postingperiod) as period
        FROM
        transaction
        INNER JOIN transactionline ON transactionline.transaction = transaction.id
        AND transactionline.mainline = 'T'
        WHERE
        transactionline.createdfrom = ${so_id}
        AND transaction.type = 'ItemShip'
        `
        return query.runSuiteQL(theQuery).asMappedResults()[0]?.period
    }

    function get_ifs_from_so_id(so_id) {
        var theQuery = `
        SELECT
        transaction.id
        FROM
        transaction
        INNER JOIN transactionline ON transactionline.transaction = transaction.id
        AND transactionline.mainline = 'T'
        WHERE
        transactionline.createdfrom = ${so_id}
        AND transaction.type = 'ItemShip'
        `
        return query.runSuiteQL(theQuery).asMappedResults().map(x => x.id)
    }   

    return {
        pageInit: pageInit,
        saveRecord: saveRecord
    };
    
});
