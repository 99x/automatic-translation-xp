const Cache = require('/lib/cache')
const Schema = require('/lib/xp/schema')

let schemaStructureCache = {}

module.exports = {
    existsSchemaStructureCache,
    getSchemaStructureCache,
    setSchemaStructureCache,

    getSchemaStructure,
    getSchemaFieldsStructure
}

function existsSchemaStructureCache(refType, refName) {
    return schemaStructureCache[refType] && schemaStructureCache[refType].getIfPresent(refName)
}

function getSchemaStructureCache(refType, refName) {
    if (!schemaStructureCache[refType]) {
        schemaStructureCache[refType] = Cache.newCache({})
    }

    return schemaStructureCache[refType].getIfPresent(refName)
}

function setSchemaStructureCache(refType, refName, value) {
    if (!schemaStructureCache[refType]) {
        schemaStructureCache[refType] = Cache.newCache({})
    }

    schemaStructureCache[refType].put(refName, value)
}

function getSchemaStructure(refType, refName) {
    let schema = null

    try {
        if (['CONTENT_TYPE', 'XDATA', 'MIXIN'].indexOf(refType) !== -1) {
            schema = Schema.getSchema({
                name: refName,
                type: refType
            })
        } else if (['PAGE', 'PART', 'LAYOUT'].indexOf(refType) !== -1) {
            schema = Schema.getComponent({
                key: refName,
                type: refType
            })
        }
    } catch(err) {
        log.error(`Failed to getSchema from (${refType}-${refName})`)
    }

    return schema
}

function getSchemaFieldsStructure(schema, refType, refName) {
    let result = {}

    function traverseItems(items, parentKey) {
        for (var i = 0; i < items.length; i++) {
            var item = items[i]
            var currentKey = parentKey

            if (item.formItemType === 'InlineMixin') {
                const schemaStructureCache = getSchemaStructureCache(refType, refName)

                const mixinSchema = getSchemaStructure('MIXIN', item.name)
                const mixinStructure = schemaStructureCache || getSchemaFieldsStructure(mixinSchema, 'MIXIN', item.name)

                Object.keys(mixinStructure).forEach(str => {
                    const newKey = currentKey ? `${currentKey}.${str}` : str
                    result[newKey] = mixinStructure[str]
                })
            } else {
                if (item.formItemType !== 'Layout') {
                    currentKey = currentKey ? currentKey + '.' + item.name : item.name
                }
    
                if (currentKey && item.inputType) {
                    result[currentKey] = item.inputType
                }
    
                if (item.items && item.items.length) {
                    traverseItems(item.items, currentKey)
                } else if (item.options && item.options.length) { // Treat option-set
                    traverseItems(item.options, currentKey)
                }
            }
        }
    }

    traverseItems(schema.form)

    return result
}
