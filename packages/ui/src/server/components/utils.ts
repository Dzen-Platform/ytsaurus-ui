import {YT_LOCAL_CLUSTER_ID} from '../../shared/constants';
import {ClusterConfig, YTConfig} from '../../shared/yt-types';
import {makeLocalModeConfig} from '../config.localcluster';
import {getRealClustersConfig} from '../config.realcluster';
import ServerFactory, {getApp} from '../ServerFactory';
import {isLocalModeByEnvironment} from '../utils';

/*
  Gets config file, which can be either
  * the file containing all real clusters, or
  * the file containing config of a local cluster, with the proxy address either
    * defaulting to `process.env.PROXY` which corresponds to the case of a local interface paired with local cluster
    * provided explicitly which corresponds to a local cluster paired with the main interface running in cloud platform.
 */
function getClientConfig(
    proxy?: string,
): Pick<YTConfig, 'clusters' | 'isLocalCluster' | 'environment'> {
    if ((proxy && getApp().config.ytAllowRemoteLocalProxy) || isLocalModeByEnvironment()) {
        return makeLocalModeConfig(proxy);
    } else {
        return getRealClustersConfig();
    }
}

export function getClustersFromConfig() {
    return getClientConfig().clusters;
}

/*
  Gets particular cluster config for `cluster` name, which is either
  * a real cluster name
  * a local cluster pseudo-name
  * an address of a yt-local proxy running in some sandbox
 */
export function getClusterConfig(cluster?: string) {
    const ytConfig = getClientConfig();
    if (!cluster) {
        return {ytConfig};
    }
    const {clusters} = ytConfig;
    if (Object.hasOwnProperty.call(clusters, cluster)) {
        return {
            ytConfig,
            clusterConfig: applyInternalProxy(clusters[cluster]),
        };
    } else if (ServerFactory.isLocalClusterId(cluster)) {
        const config = getClientConfig(cluster);
        return {
            ytConfig: config,
            clusterConfig: applyInternalProxy(config.clusters[cluster]),
        };
    } else {
        return {ytConfig};
    }
}

/**
 * PROXY_INTERNAL environment variable should be applied only for 'ui' cluster.
 * Do not use `isLocalClusterId(...)` in the function!
 */
function applyInternalProxy(clusterConfig: ClusterConfig) {
    const internalProxyName = process.env.PROXY_INTERNAL;
    if (!internalProxyName || clusterConfig.id !== YT_LOCAL_CLUSTER_ID) {
        return clusterConfig;
    }
    return {
        ...clusterConfig,
        proxy: internalProxyName,
    };
}

interface CacheItem<T> {
    value: T;
    expiry: number;
}

export class LRUCacheWithTTL<T> {
    private cache: Map<string, CacheItem<T>>;
    private max: number;
    private maxAge: number;

    constructor(max: number, maxAge: number) {
        this.cache = new Map<string, CacheItem<T>>();
        this.max = max;
        this.maxAge = maxAge;
    }

    get(key: any): T | undefined {
        const stringKey = JSON.stringify(key);
        const item = this.cache.get(stringKey);
        if (item && Date.now() < item.expiry) {
            // Refresh the item's expiry
            item.expiry = Date.now() + this.maxAge;
            // Rearrange item in the cache to keep it most recently used
            this.cache.delete(stringKey);
            this.cache.set(stringKey, item);
            return item.value;
        } else {
            // Item not found or expired
            this.cache.delete(stringKey);
            return undefined;
        }
    }

    has(key: any): boolean {
        const stringKey = JSON.stringify(key);
        return this.cache.has(stringKey);
    }

    set(key: any, value: T): void {
        const stringKey = JSON.stringify(key);
        // If cache is at max capacity, remove the least recently used item
        if (this.cache.size >= this.max) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        // Set the item with its expiry
        this.cache.set(stringKey, { value, expiry: Date.now() + this.maxAge });
    }

    delete(key: any): void {
        const stringKey = JSON.stringify(key);
        this.cache.delete(stringKey);
    }

    clear(): void {
        this.cache.clear();
    }
}

