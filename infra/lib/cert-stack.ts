import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';

export interface CertStackProps extends StackProps {
  domainName: string;
  zoneId: string;
}

/**
 * CloudFront requires its ACM certificate in us-east-1.
 * This stack lives there and exports the cert via cross-region references.
 */
export class CertStack extends Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.zoneId,
      zoneName: props.domainName,
    });

    const cert = new acm.Certificate(this, 'FrontendCert', {
      domainName: props.domainName,
      subjectAlternativeNames: [`www.${props.domainName}`],
      validation: acm.CertificateValidation.fromDns(zone),
    });

    this.certificate = cert;

    new CfnOutput(this, 'CertificateArn', { value: cert.certificateArn });
  }
}
