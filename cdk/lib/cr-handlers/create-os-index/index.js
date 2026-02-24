/**
 * Custom Resource handler: creates the Bedrock vector index in OpenSearch Serverless.
 * Includes retry logic because AOSS data access policies take up to ~30s to propagate.
 */
const https = require('https');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { SignatureV4 } = require('@smithy/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');

const INDEX_NAME = 'bedrock-knowledge-base-default-index';
const VECTOR_DIMENSION = 1024; // Amazon Titan Embed v2 default

const INDEX_BODY = JSON.stringify({
  settings: {
    index: {
      knn: true,
      'knn.algo_param.ef_search': 512,
    },
  },
  mappings: {
    properties: {
      'bedrock-knowledge-base-default-vector': {
        type: 'knn_vector',
        dimension: VECTOR_DIMENSION,
        method: {
          name: 'hnsw',
          engine: 'faiss',
          space_type: 'l2',
          parameters: {},
        },
      },
      AMAZON_BEDROCK_TEXT_CHUNK: { type: 'text', index: true },
      AMAZON_BEDROCK_METADATA: { type: 'text', index: false },
    },
  },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signedRequest(method, url, body) {
  const parsedUrl = new URL(url);
  const region = process.env.REGION;
  const credentials = await defaultProvider()();

  const signer = new SignatureV4({
    credentials,
    region,
    service: 'aoss',
    sha256: Sha256,
  });

  const bodyStr = body || '';
  const request = {
    method,
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname,
    headers: {
      host: parsedUrl.hostname,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(bodyStr).toString(),
    },
    body: bodyStr,
  };

  const signed = await signer.sign(request);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: signed.hostname,
        path: signed.path,
        method: signed.method,
        headers: signed.headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          console.log(`${method} ${url} → ${res.statusCode}: ${data.substring(0, 300)}`);
          resolve({ statusCode: res.statusCode, body: data });
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function createIndexWithRetry(collectionEndpoint, maxAttempts = 12, delayMs = 15000) {
  const indexUrl = `${collectionEndpoint}/${INDEX_NAME}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Attempt ${attempt}/${maxAttempts}: checking if index exists...`);

    try {
      // Check if index already exists
      const headRes = await signedRequest('HEAD', indexUrl, '');
      if (headRes.statusCode === 200) {
        console.log('Index already exists, done.');
        return;
      }

      // Try to create the index
      const putRes = await signedRequest('PUT', indexUrl, INDEX_BODY);
      if (putRes.statusCode >= 200 && putRes.statusCode < 300) {
        console.log('Index created successfully.');
        return;
      }

      if (putRes.statusCode === 403) {
        console.log(`403 on attempt ${attempt} — data access policy still propagating. Waiting ${delayMs}ms...`);
      } else {
        console.log(`Unexpected status ${putRes.statusCode} on attempt ${attempt}. Waiting...`);
      }
    } catch (err) {
      console.log(`Network error on attempt ${attempt}: ${err.message}. Waiting...`);
    }

    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }

  throw new Error(`Failed to create index after ${maxAttempts} attempts.`);
}

exports.handler = async (event) => {
  console.log('Event type:', event.RequestType);
  const { CollectionEndpoint } = event.ResourceProperties;

  if (event.RequestType === 'Delete') {
    await sendCfnResponse(event, 'SUCCESS', {});
    return;
  }

  try {
    console.log(`Waiting 30s for AOSS data access policy to propagate before first attempt...`);
    await sleep(30000);

    await createIndexWithRetry(CollectionEndpoint);
    await sendCfnResponse(event, 'SUCCESS', { IndexName: INDEX_NAME });
  } catch (err) {
    console.error('Error creating index:', err);
    await sendCfnResponse(event, 'FAILED', {}, String(err));
  }
};

async function sendCfnResponse(event, status, data, reason) {
  const body = JSON.stringify({
    Status: status,
    Reason: reason || 'See CloudWatch logs',
    PhysicalResourceId: `os-index-${INDEX_NAME}`,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: data,
  });

  const url = new URL(event.ResponseURL);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'PUT',
        headers: {
          'content-type': '',
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        res.on('end', resolve);
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
