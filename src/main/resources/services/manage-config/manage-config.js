const Schema = require('/lib/xp/schema')

const AutomaticTranslation = require('/lib/modules/automatic-translation')
const AutomaticTranslationConfig = require('/lib/modules/automatic-translation/config')
const Util = require('/lib/modules/util')

exports.get = (req) => {
    function getRefTypeLabels(refType) {
        switch(refType) {
            case 'CONTENT_TYPE': return 'Content Type'
            case 'XDATA': return 'X-Data'
            case 'PAGE': return 'Page'
            case 'PART': return 'Part'
            case 'LAYOUT': return 'Layout'
        }
    }
    
    const siteId = req.params.site
    const repoId = req.params.repo
    const applicationKey = req.params.application

    const currentConfig = AutomaticTranslationConfig.getConfig(siteId, repoId, applicationKey)

    let response = []

    const refTypesSchemas = ['CONTENT_TYPE', 'XDATA']
    const refTypesComponents = ['PAGE', 'PART', 'LAYOUT']

    // Schemas
    refTypesSchemas.forEach(refType => {
        const schemas = Schema.listSchemas({
            application: applicationKey,
            type: refType
        })

        if (schemas.length > 0) {
            response.push({
                text: getRefTypeLabels(refType),
                children: []
            })
        }

        schemas.forEach(schema => {
            let result
            if (!AutomaticTranslation.existsSchemaStructureCache(refType, schema.name)) {
                result = AutomaticTranslation.getSchemaFieldsStructure(schema)
                AutomaticTranslation.setSchemaStructureCache(refType, schema.name, result)
            } else {
                result = AutomaticTranslation.getSchemaStructureCache(refType, schema.name)
            }

            if (result) {
                const resultTranslatableKeys = Object.keys(result).filter(rKey => ['TextLine', 'TextArea', 'HtmlArea'].indexOf(result[rKey]) !== -1)
                if (resultTranslatableKeys.length > 0) {
                    response[response.length - 1].children.push({
                        text: `${schema.displayName} (${schema.name})`,
                        children: resultTranslatableKeys.map(resultKey => {
                            const parentKey = schema.name.split(':')[1]
                            const parentKeyConfig = (currentConfig && currentConfig[refType] && currentConfig[refType][parentKey]) || []
                            return {
                                text: `${resultKey} (${result[resultKey]})`,
                                state: {
                                    selected: parentKeyConfig.indexOf(resultKey) !== -1
                                },
                                li_attr: {
                                    'data-key': resultKey,
                                    'data-parent-key': parentKey,
                                    'data-ref-type': refType
                                }
                            }
                        })
                    })
                }
            }
        })
    })

    // Components
    refTypesComponents.forEach(refType => {
        const schemas = Schema.listComponents({
            application: applicationKey,
            type: refType
        })

        if (schemas.length > 0) {
            response.push({
                text: getRefTypeLabels(refType),
                children: []
            })
        }

        schemas.forEach(schema => {
            let result
            if (!AutomaticTranslation.existsSchemaStructureCache(refType, schema.key)) {
                result = AutomaticTranslation.getSchemaFieldsStructure(schema)
                AutomaticTranslation.setSchemaStructureCache(refType, schema.key, result)
            } else {
                result = AutomaticTranslation.getSchemaStructureCache(refType, schema.key)
            }

            if (result) {
                const resultTranslatableKeys = Object.keys(result).filter(rKey => ['TextLine', 'TextArea', 'HtmlArea'].indexOf(result[rKey]) !== -1)
                if (resultTranslatableKeys.length > 0) {
                    response[response.length - 1].children.push({
                        text: `${schema.displayName} (${schema.key})`,
                        children: resultTranslatableKeys.map(resultKey => {
                            const parentKey = schema.key.split(':')[1]
                            const parentKeyConfig = (currentConfig && currentConfig[refType] && currentConfig[refType][parentKey]) || []
                            return {
                                text: `${resultKey} (${result[resultKey]})`,
                                state: {
                                    selected: parentKeyConfig.indexOf(resultKey) !== -1
                                },
                                li_attr: {
                                    'data-key': resultKey,
                                    'data-parent-key': parentKey,
                                    'data-ref-type': refType
                                }
                            }
                        })
                    })
                }
            }
        })
    })

    response = response.filter(r => r.children.length > 0)

    return {
        body: response,
        contentType: 'application/json'
    }
}

exports.put = (req) => {
    const siteId = req.params.site
    const repoId = req.params.repo
    const applicationKey = req.params.application
    const mode = req.params.mode

    const body = Util.parseJSON(req.body)

    if (mode == 'all' && applicationKey && body) {
        const sites = AutomaticTranslationConfig.getSites()
        sites.forEach(site => {
            AutomaticTranslationConfig.setConfig(site.id, site.repoId, applicationKey, body)
        })
    } else if (siteId && repoId && applicationKey && body) {
        AutomaticTranslationConfig.setConfig(siteId, repoId, applicationKey, body)
    }

    return {
        status: 200
    }
}
