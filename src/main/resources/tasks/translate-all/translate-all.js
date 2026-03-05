const Content = require('/lib/xp/content')
const Context = require('/lib/xp/context')
const Node = require('/lib/xp/node')
const Task = require('/lib/xp/task')

const AutomaticTranslationConfig = require('/lib/modules/automatic-translation/config')
const AutomaticTranslation = require('/lib/modules/automatic-translation')
const Translate = require('/lib/modules/automatic-translation/translate')

const BATCH_SIZE = 100

function getFullyIgnoredContentTypes(iataConfig) {
    const excluded = []
    if (!iataConfig || typeof iataConfig !== 'object') return excluded

    for (const appKey in iataConfig) {
        if (!iataConfig.hasOwnProperty(appKey) || !iataConfig[appKey].CONTENT_TYPE) continue

        const contentTypeConfig = iataConfig[appKey].CONTENT_TYPE
        for (const contentKey in contentTypeConfig) {
            if (!contentTypeConfig.hasOwnProperty(contentKey)) continue

            const fullTypeName = appKey.replace(/-/g, '.') + ':' + contentKey
            let schema
            try {
                schema = AutomaticTranslation.getSchemaStructure('CONTENT_TYPE', fullTypeName)
            } catch (e) {
                continue
            }
            if (!schema || !schema.form) continue

            const fieldsStructure = AutomaticTranslation.getSchemaFieldsStructure(schema, 'CONTENT_TYPE', fullTypeName)
            const translatableFields = []
            for (const fieldName in fieldsStructure) {
                if (fieldsStructure.hasOwnProperty(fieldName) && ['TextLine', 'TextArea', 'HtmlArea'].indexOf(fieldsStructure[fieldName]) !== -1) {
                    translatableFields.push(fieldName)
                }
            }

            const ignoredFields = contentTypeConfig[contentKey] || []
            let allIgnored = true
            for (let i = 0; i < translatableFields.length; i++) {
                if (ignoredFields.indexOf(translatableFields[i]) === -1) {
                    allIgnored = false
                    break
                }
            }
            if (translatableFields.length > 0 && allIgnored) {
                excluded.push(fullTypeName)
            }
        }
    }
    return excluded
}

exports.run = function(params, taskId) {
    const siteId = params.siteId
    const repoId = params.repoId

    if (!siteId || !repoId) {
        throw new Error('siteId and repoId are required')
    }

    const repo = `com.enonic.cms.${repoId}`

    return Context.run({
        repository: repo,
        branch: 'draft',
        user: {
            login: 'su',
            idProvider: 'system'
        },
        principals: ['role:system.admin']
    }, () => {
        const site = Content.get({ key: siteId })
        if (!site) {
            throw new Error(`Site not found: ${siteId}`)
        }

        const siteConfig = Content.getSiteConfig({
            key: siteId,
            applicationKey: app.name
        }) || {}

        const apiInfo = {
            authKey: siteConfig.google_api_key || '',
            sourceLanguage: siteConfig.google_api_source_language || '',
            targetLanguage: siteConfig.google_api_target_language || ''
        }

        if (!apiInfo.authKey || !apiInfo.sourceLanguage || !apiInfo.targetLanguage) {
            throw new Error('Site must have Google API key, source language and target language configured')
        }

        const iataConfig = AutomaticTranslationConfig.getConfig(siteId, repoId) || {}

        const rawPath = site._path || ''
        const sitePath = rawPath.startsWith('/content') ? rawPath : `/content${rawPath.startsWith('/') ? rawPath : '/' + rawPath}`
        const escapedPath = sitePath.replace(/'/g, "''")
        const excludedTypes = getFullyIgnoredContentTypes(iataConfig)
        let queryStr = `_path LIKE '${escapedPath}/*'`
        if (excludedTypes.length > 0) {
            const typeList = excludedTypes.map(t => "'" + (t || '').split("'").join("''") + "'").join(', ')
            queryStr += ` AND type NOT IN (${typeList})`
        }
        const allContentIds = []
        let start = 0
        let hasMore = true

        while (hasMore) {
            const result = Content.query({
                start,
                count: BATCH_SIZE,
                query: queryStr
            })

            if (result.hits && result.hits.length > 0) {
                result.hits.forEach(hit => allContentIds.push(hit._id))
                start += result.hits.length
                hasMore = result.hits.length === BATCH_SIZE
            } else {
                hasMore = false
            }
        }

        const total = allContentIds.length
        Task.progress({ info: `Translating ${total} contents`, current: 0, total })

        const DraftRepo = Node.connect({
            repoId: repo,
            branch: 'draft',
            principals: ['role:system.admin']
        })
        const MasterRepo = Node.connect({
            repoId: repo,
            branch: 'master',
            principals: ['role:system.admin']
        })

        let current = 0
        for (const contentId of allContentIds) {
            let displayName = contentId
            try {
                const content = Content.get({ key: contentId })
                if (content) {
                    displayName = content.displayName || contentId

                    const draftNode = DraftRepo.get(contentId)
                    const masterNode = MasterRepo.get(contentId)
                    const wasInSync = draftNode && masterNode && draftNode._versionKey === masterNode._versionKey

                    Translate.autoTranslate(contentId, apiInfo, iataConfig)

                    if (wasInSync) {
                        Content.publish({
                            keys: [contentId],
                            sourceBranch: 'draft',
                            targetBranch: 'master',
                            includeDependencies: false
                        })
                    }
                }
            } catch (err) {
                log.warning(`Failed to translate content ${contentId}: ${err.message}`)
            }

            current++
            Task.progress({ info: `Translated ${displayName}`, current, total })
        }

        Task.progress({ info: 'Bulk translation completed', current: total, total })
    })
}
