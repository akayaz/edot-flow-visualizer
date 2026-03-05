/**
 * EUI Icon Cache for Next.js
 *
 * EUI loads icons via dynamic imports (`import('./assets/...')`) which fail in Next.js
 * because the generated chunks are not properly served. This file statically imports
 * all icons used in the application and registers them in EUI's icon component cache,
 * bypassing the broken dynamic loading.
 *
 * When you add a new EUI icon to the project, add its import and cache entry here.
 */
import { appendIconComponentCache } from '@elastic/eui/es/components/icon/icon';

// --- Logo icons ---
import { icon as logoCloud } from '@elastic/eui/es/components/icon/assets/logo_cloud';
import { icon as logoElasticStack } from '@elastic/eui/es/components/icon/assets/logo_elastic_stack';
import { icon as logoElastic } from '@elastic/eui/es/components/icon/assets/logo_elastic';
import { icon as logoObservability } from '@elastic/eui/es/components/icon/assets/logo_observability';
import { icon as logoDocker } from '@elastic/eui/es/components/icon/assets/logo_docker';
import { icon as logoKubernetes } from '@elastic/eui/es/components/icon/assets/logo_kubernetes';
import { icon as logoKafka } from '@elastic/eui/es/components/icon/assets/logo_kafka';

// --- Standard icons ---
import { icon as wrench } from '@elastic/eui/es/components/icon/assets/wrench';
import { icon as info } from '@elastic/eui/es/components/icon/assets/info';
import { icon as flask } from '@elastic/eui/es/components/icon/assets/flask'; // beaker maps to flask
import { icon as cloudSunny } from '@elastic/eui/es/components/icon/assets/cloudSunny';
import { icon as launch } from '@elastic/eui/es/components/icon/assets/launch';
import { icon as layers } from '@elastic/eui/es/components/icon/assets/layers';
import { icon as exportIcon } from '@elastic/eui/es/components/icon/assets/export'; // exportAction maps to export
import { icon as sparkles } from '@elastic/eui/es/components/icon/assets/sparkles';
import { icon as eraser } from '@elastic/eui/es/components/icon/assets/eraser';
import { icon as logstashQueue } from '@elastic/eui/es/components/icon/assets/logstash_queue';
import { icon as compute } from '@elastic/eui/es/components/icon/assets/compute';
import { icon as grab } from '@elastic/eui/es/components/icon/assets/grab';
import { icon as grid } from '@elastic/eui/es/components/icon/assets/grid';
import { icon as online } from '@elastic/eui/es/components/icon/assets/online';
import { icon as importAction } from '@elastic/eui/es/components/icon/assets/import'; // importAction maps to import
import { icon as check } from '@elastic/eui/es/components/icon/assets/check';
import { icon as checkInCircleFilled } from '@elastic/eui/es/components/icon/assets/checkInCircleFilled';
import { icon as arrowLeft } from '@elastic/eui/es/components/icon/assets/arrow_left';
import { icon as arrowRight } from '@elastic/eui/es/components/icon/assets/arrow_right';
import { icon as arrowUp } from '@elastic/eui/es/components/icon/assets/arrow_up';
import { icon as arrowDown } from '@elastic/eui/es/components/icon/assets/arrow_down';
import { icon as gear } from '@elastic/eui/es/components/icon/assets/gear';
import { icon as moon } from '@elastic/eui/es/components/icon/assets/moon';
import { icon as sun } from '@elastic/eui/es/components/icon/assets/sun';
import { icon as warning } from '@elastic/eui/es/components/icon/assets/warning';
import { icon as error } from '@elastic/eui/es/components/icon/assets/error';
import { icon as cross } from '@elastic/eui/es/components/icon/assets/cross';
import { icon as popout } from '@elastic/eui/es/components/icon/assets/popout';
import { icon as visArea } from '@elastic/eui/es/components/icon/assets/vis_area';
import { icon as heart } from '@elastic/eui/es/components/icon/assets/heart';
import { icon as dot } from '@elastic/eui/es/components/icon/assets/dot';
import { icon as folderOpen } from '@elastic/eui/es/components/icon/assets/folder_open';
import { icon as copy } from '@elastic/eui/es/components/icon/assets/copy';
import { icon as download } from '@elastic/eui/es/components/icon/assets/download';
import { icon as refresh } from '@elastic/eui/es/components/icon/assets/refresh';
import { icon as document } from '@elastic/eui/es/components/icon/assets/document';
import { icon as expand } from '@elastic/eui/es/components/icon/assets/expand';
import { icon as lock } from '@elastic/eui/es/components/icon/assets/lock';
import { icon as database } from '@elastic/eui/es/components/icon/assets/database';
import { icon as pencil } from '@elastic/eui/es/components/icon/assets/pencil';
import { icon as bell } from '@elastic/eui/es/components/icon/assets/bell';
import { icon as empty } from '@elastic/eui/es/components/icon/assets/empty';
import { icon as apps } from '@elastic/eui/es/components/icon/assets/apps';
import { icon as help } from '@elastic/eui/es/components/icon/assets/help';
import { icon as plusInCircle } from '@elastic/eui/es/components/icon/assets/plus_in_circle';
import { icon as minusInCircle } from '@elastic/eui/es/components/icon/assets/minus_in_circle';
import { icon as crosshairs } from '@elastic/eui/es/components/icon/assets/crosshairs';
import { icon as bolt } from '@elastic/eui/es/components/icon/assets/bolt';

// Register all icons in the EUI icon cache
appendIconComponentCache({
  // Logos
  logoCloud,
  logoElasticStack,
  logoElastic,
  logoObservability,
  logoDocker,
  logoKubernetes,
  logoKafka,

  // Standard icons
  wrench,
  info,
  beaker: flask,
  cloudSunny,
  launch,
  layers,
  export: exportIcon,
  exportAction: exportIcon,
  sparkles,
  eraser,
  logstashQueue,
  compute,
  grab,
  grid,
  online,
  import: importAction,
  importAction,
  check,
  checkInCircleFilled,
  arrowLeft,
  arrowRight,
  arrowUp,
  arrowDown,
  gear,
  moon,
  sun,
  warning,
  alert: warning,
  error,
  cross,
  popout,
  visArea,
  heart,
  dot,
  folderOpen,
  copy,
  copyClipboard: copy,
  download,
  refresh,
  document,
  expand,
  lock,
  database,
  pencil,
  documentEdit: pencil,
  bell,
  empty,
  apps,
  help,
  plusInCircle,
  listAdd: plusInCircle,
  minusInCircle,
  crosshairs,
  bolt,
});
