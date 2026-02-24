import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
  RetrieveAndGenerateCommandInput,
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  BedrockAgentClient,
  StartIngestionJobCommand,
} from '@aws-sdk/client-bedrock-agent';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

const region = process.env.REGION!;

const agentRuntimeClient = new BedrockAgentRuntimeClient({ region });
const agentClient = new BedrockAgentClient({ region });
const runtimeClient = new BedrockRuntimeClient({ region });

const LLM_MODEL_ID = process.env.LLM_MODEL_ID!;

export async function retrieveAndGenerate(
  knowledgeBaseId: string,
  question: string,
  sessionId?: string
): Promise<{ answer: string; citations: Array<{ text: string; location?: unknown }> }> {
  const input: RetrieveAndGenerateCommandInput = {
    input: { text: question },
    retrieveAndGenerateConfiguration: {
      type: 'KNOWLEDGE_BASE',
      knowledgeBaseConfiguration: {
        knowledgeBaseId,
        modelArn: `arn:aws:bedrock:${region}::foundation-model/${LLM_MODEL_ID}`,
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 5,
          },
        },
      },
    },
  };

  if (sessionId) {
    input.sessionId = sessionId;
  }

  const response = await agentRuntimeClient.send(new RetrieveAndGenerateCommand(input));

  const citations = (response.citations ?? []).flatMap((citation) =>
    (citation.retrievedReferences ?? []).map((ref) => ({
      text: ref.content?.text ?? '',
      location: ref.location as { s3Location?: { uri: string } } | undefined,
    }))
  );

  return {
    answer: response.output?.text ?? '',
    citations,
  };
}

export async function startIngestionJob(
  knowledgeBaseId: string,
  dataSourceId: string
): Promise<string> {
  const response = await agentClient.send(
    new StartIngestionJobCommand({
      knowledgeBaseId,
      dataSourceId,
    })
  );
  return response.ingestionJob?.ingestionJobId ?? '';
}

export async function invokeLlm(prompt: string, systemPrompt?: string): Promise<string> {
  const messages = [{ role: 'user', content: prompt }];

  const body = JSON.stringify({
    prompt: systemPrompt
      ? `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`
      : `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
    max_gen_len: 4096,
    temperature: 0.3,
    top_p: 0.9,
  });

  const response = await runtimeClient.send(
    new InvokeModelCommand({
      modelId: LLM_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: Buffer.from(body),
    })
  );

  const responseBody = JSON.parse(Buffer.from(response.body).toString('utf-8'));
  return responseBody.generation ?? '';
}
