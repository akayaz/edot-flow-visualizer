import { EDOTSDKNode } from './EDOTSDKNode';
import { CollectorNode } from './CollectorNode';
import { ElasticNode } from './ElasticNode';
import { HostNode } from './HostNode';
import { DockerNode } from './DockerNode';
import { K8sNamespaceNode } from './K8sNamespaceNode';
import { K8sDaemonSetNode } from './K8sDaemonSetNode';
import { K8sDeploymentNode } from './K8sDeploymentNode';

export const nodeTypes = {
  edotSdk: EDOTSDKNode,
  collector: CollectorNode,
  elasticApm: ElasticNode,
  infrastructureHost: HostNode,
  infrastructureDocker: DockerNode,
  infrastructureK8sNamespace: K8sNamespaceNode,
  infrastructureK8sDaemonSet: K8sDaemonSetNode,
  infrastructureK8sDeployment: K8sDeploymentNode,
};

export {
  EDOTSDKNode,
  CollectorNode,
  ElasticNode,
  HostNode,
  DockerNode,
  K8sNamespaceNode,
  K8sDaemonSetNode,
  K8sDeploymentNode,
};
