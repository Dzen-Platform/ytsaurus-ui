import './afterEach';

export const {BASE_URL, CLUSTER, E2E_DIR, E2E_OPERATION_ID, E2E_OPERATION_2_ID, CLUSTER_TITLE} =
    process.env;

console.log({BASE_URL, CLUSTER, CLUSTER_TITLE, E2E_DIR, E2E_OPERATION_ID, E2E_OPERATION_2_ID});

if (!CLUSTER || !E2E_DIR) {
    throw new Error('E2E environment is not prepared');
}

export function makeUrl(pathWithParams = '') {
    return [BASE_URL, pathWithParams].filter(Boolean).join('/');
}

export function makeClusterUrl(pathWithParams = '') {
    return [BASE_URL, CLUSTER, pathWithParams].filter(Boolean).join('/');
}

export function makeClusterTille({path, page}: {path?: string; page?: string}) {
    return [path, page, CLUSTER_TITLE ?? capitalize(CLUSTER)].filter(Boolean).join(' - ');
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
