
const fs = require('fs');
const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

function mergeConfigMaps(name, dir, configmaps, namespace) {
    namespace = namespace || 'kaltura';
    var data = {}
    
    var files = fs.readdirSync(`${__dirname}/${dir}`);
    files.forEach(file => {
        data[file] = fs.readFileSync(`${__dirname}/${dir}/${file}`, 'utf-8');
    });

    configmaps.forEach(configmap => {
        Object.keys(configmap.data).forEach(yaml => {
            data[yaml] = configmap.data[yaml];
        });
    });
    
    var configmap = new k8s.V1ConfigMap();
    configmap.apiVersion = 'v1';
    configmap.data = data;
    configmap.metadata = new k8s.V1ObjectMeta();
    configmap.metadata.name = name;
    configmap.metadata.namespace = namespace;
    return configmap;
}

function areDifferent(a, b) {
    var keys = Object.keys(a);
    keys.sort();
    
    var keysB = Object.keys(b);
    keysB.sort();
    if(JSON.stringify(keys) != JSON.stringify(keysB)) {
        return true;
    }

    var objA = {};
    var objB = {};    
    for(var i = 0; i < keys.length; i++) {
        var key = keys[i];
        objA[key] = a[key];
        objB[key] = b[key];
    }

    return JSON.stringify(objA) != JSON.stringify(objB);
}

k8sApi.listNamespacedConfigMap('kaltura')
.then(response => {
    const all = response.body.items;

    const filebeatMaps = all.filter(configmap => configmap.metadata.labels && configmap.metadata.labels['kaltura-type'] === 'filebeat-config');
    const newGeneratedFilebeat = mergeConfigMaps('generated-filebeat-inputs', 'filebeat', filebeatMaps);
    const existingGeneratedFilebeat = all.find(configmap => configmap.metadata.name == 'generated-filebeat-inputs');
    if(!existingGeneratedFilebeat) {
        k8sApi.createNamespacedConfigMap('kaltura', newGeneratedFilebeat)
        .then(response => console.log('Generated filebeat map created'))
        .catch(err => console.error('Failed to create filebeat config-map: ', (err.response ? err.response.body : err)));
    }
    else if(areDifferent(existingGeneratedFilebeat.data, newGeneratedFilebeat.data)) {
        console.log('Existing generated filebeat map is different than new one');
        k8sApi.replaceNamespacedConfigMap('generated-filebeat-inputs', 'kaltura', newGeneratedFilebeat)
        .then(response => console.log('Generated filebeat map replaced'))
        .catch(err => console.error('Failed to replace filebeat config-map: ', (err.response ? err.response.body : err)));
    }
    
    const logstashMaps = all.filter(configmap => configmap.metadata.labels && configmap.metadata.labels['kaltura-type'] === 'logstash-config');
    const newGeneratedLogstash = mergeConfigMaps('generated-logstash-pipeline', 'logstash', logstashMaps);
    const existingGeneratedLogstash = all.find(configmap => configmap.metadata.name == 'generated-logstash-pipeline');
    if(!existingGeneratedLogstash) {
        k8sApi.createNamespacedConfigMap('kaltura', newGeneratedLogstash)
        .then(response => console.log('Generated logstash map created'))
        .catch(err => console.error('Failed to create logstash config-map: ', (err.response ? err.response.body : err)));
    }
    if(areDifferent(existingGeneratedLogstash.data, newGeneratedLogstash.data)) {
        console.log('Existing generated logstash map is different than new one');
        k8sApi.replaceNamespacedConfigMap('generated-logstash-pipeline', 'kaltura', newGeneratedLogstash)
        .then(response => console.log('Generated logstash map replaced'))
        .catch(err => console.error('Failed to replace logstash config-map: ', (err.response ? err.response.body : err)));
    }
})
.catch(err => console.error('Failed to get kaltura config-maps: ', (err.response ? err.response.body : err)));
