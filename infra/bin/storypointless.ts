#!/usr/bin/env node
import 'aws-cdk-lib';
import { App, Tags } from 'aws-cdk-lib';
import { CertStack } from '../lib/cert-stack.ts';
import { BackendStack } from '../lib/backend-stack.ts';
import { FrontendStack } from '../lib/frontend-stack.ts';

const account = process.env.CDK_DEFAULT_ACCOUNT ?? '457188933271';
const primaryRegion = 'eu-west-2';
const certRegion = 'us-east-1';

const domainName = 'storypointless.com';
const zoneId = 'Z04612711KZXB3DL2CDNP';

const app = new App();

// Tag every resource so the Storypointless monthly budget can filter by it.
// Activate `Project` as a cost-allocation tag in the Billing console (the
// deploy script does this automatically; no-op once active).
Tags.of(app).add('Project', 'storypointless');

const cert = new CertStack(app, 'StorypointlessCert', {
  env: { account, region: certRegion },
  crossRegionReferences: true,
  domainName,
  zoneId,
});

new BackendStack(app, 'StorypointlessBackend', {
  env: { account, region: primaryRegion },
  domainName,
  zoneId,
});

const frontend = new FrontendStack(app, 'StorypointlessFrontend', {
  env: { account, region: primaryRegion },
  crossRegionReferences: true,
  domainName,
  zoneId,
  certificate: cert.certificate,
});
frontend.addDependency(cert);
