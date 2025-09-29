import './polyfills/process';
import { installMonacoValidationWorker } from '../../core/monaco/worker';

installMonacoValidationWorker({
  markerSource: 'pine-validator',
  validatorConfig: {
    targetVersion: 6,
    strictMode: true,
    allowDeprecated: true,
    enableTypeChecking: true,
    enableControlFlowAnalysis: true,
    enablePerformanceAnalysis: true,
    enableWarnings: true,
    enableInfo: true,
  },
});
