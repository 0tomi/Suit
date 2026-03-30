import { createResourceContext } from './createResourceContext.jsx';
import { syncTemplateCategories } from '../services/sync/templateSyncService.js';

const {
    Context: TemplateCategoriesContext,
    Provider: TemplateCategoriesProvider,
    useResource: useTemplateCategoriesResource
} = createResourceContext({
    resourceName: 'template_categories',
    syncFn: syncTemplateCategories,
});

function useTemplateCategories() {
    const resource = useTemplateCategoriesResource();

    return {
        ...resource,
        refreshTemplateCategories: resource.refreshTemplateCategories,
        loadLocalTemplateCategories: resource.loadLocalData,
    };
}

export { TemplateCategoriesContext, TemplateCategoriesProvider, useTemplateCategories };
export default TemplateCategoriesContext;
