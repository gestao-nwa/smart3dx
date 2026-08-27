<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Método não permitido.'
    ]);

    exit;
}

/*
|--------------------------------------------------------------------------
| CONFIGURAÇÕES DO KOMMO
|--------------------------------------------------------------------------
|
| Exemplo de subdomínio:
| https://smart3dx.kommo.com
|
| Coloque apenas:
| smart3dx
|
*/

$kommoSubdomain = 'smart3dx';
$kommoToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImViZjI3YmU4ZTBhZjBkYTdiYmM3MzFjMDNkYmFjNTZkMWM5NjMzNTllNjY0MzljZjA0MDQ3NjcwYzZlZmEwMDk1MWFjYjk5YzQzNjMwMDMyIn0.eyJhdWQiOiJhNmQ1Njg5Ni05YWUwLTRjOTktODhiNi0zZjk1YTY4NzE5MWYiLCJqdGkiOiJlYmYyN2JlOGUwYWYwZGE3YmJjNzMxYzAzZGJhYzU2ZDFjOTYzMzU5ZTY2NDM5Y2YwNDA0NzY3MGM2ZWZhMDA5NTFhY2I5OWM0MzYzMDAzMiIsImlhdCI6MTc4MzQ0OTA1OSwibmJmIjoxNzgzNDQ5MDU5LCJleHAiOjE5MjQ5MDU2MDAsInN1YiI6Ijg2OTEzNjUiLCJncmFudF90eXBlIjoiIiwiYWNjb3VudF9pZCI6MzY0MjU2NzEsImJhc2VfZG9tYWluIjoia29tbW8uY29tIiwidmVyc2lvbiI6Miwic2NvcGVzIjpbInB1c2hfbm90aWZpY2F0aW9ucyIsImZpbGVzIiwiY3JtIiwiZmlsZXNfZGVsZXRlIiwibm90aWZpY2F0aW9ucyJdLCJoYXNoX3V1aWQiOiJhNTA1NDYyNS1kNmY0LTRmZDEtOWQxMC02Mzg2NzI3NDBkODAiLCJhcGlfZG9tYWluIjoiYXBpLWcua29tbW8uY29tIn0.YB8eZhoSMx4cMx2-FGNv76Lm6_i5M83G2ESjlXh8aEPRMCD0zs6NWnSHsKgkQORFHcocOodmbRVqzZl7_sjIY8m-IovzRZiYKpL99I3bvFH1w1eVBoK8wbZw44Ydf_Vf3EijP5wUcQmVqU3UYW8-LoYVJoLkZX9QzA0kw6O6vEsSDMB_Playl4TErkYXzhzqJjSonI8MTMsJ5k6XuCfDSmCux6z9bVuR5TnW0KB-87v1FR5N2lVGZ_qf8NoOQcjifRSvRFPolgwLdKR4LTkeU6V9m01VM75xnuhn10BR5b__AYKD_BMXkhNG5gnopyOMMmfr8riIu_n9qQthafe1CQ';

/*
|--------------------------------------------------------------------------
| DESTINO DO LEAD
|--------------------------------------------------------------------------
*/

$pipelineId = 13669567;
$statusId = 105493519;

$cargoFieldId = 372690;

/*
 * Coloque aqui o ID do campo de contato
 * Produto de Interesse.
 */
$produtoInteresseFieldId = 2440435;

/*
|--------------------------------------------------------------------------
| RESPONSÁVEL
|--------------------------------------------------------------------------
|
| Opcional.
| Deixe 0 para o Kommo usar o responsável padrão.
|
*/

$responsibleUserId = 0;


/*
|--------------------------------------------------------------------------
| FUNÇÕES
|--------------------------------------------------------------------------
*/

function respond(int $status, array $data): never
{
    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    exit;
}

function kommoRequest(
    string $method,
    string $url,
    string $token,
    ?array $body = null
): array {
    $curl = curl_init($url);

    if ($curl === false) {
        throw new RuntimeException('Não foi possível iniciar o cURL.');
    }

    $headers = [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
        'Accept: application/json'
    ];

    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 30
    ];

    if ($body !== null) {
        $encodedBody = json_encode(
            $body,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );

        if ($encodedBody === false) {
            throw new RuntimeException('Erro ao converter os dados para JSON.');
        }

        $options[CURLOPT_POSTFIELDS] = $encodedBody;
    }

    curl_setopt_array($curl, $options);

    $responseBody = curl_exec($curl);
    $curlError = curl_error($curl);
    $statusCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);

    curl_close($curl);

    if ($responseBody === false) {
        throw new RuntimeException(
            'Erro de comunicação com o Kommo: ' . $curlError
        );
    }

    $decodedResponse = json_decode($responseBody, true);

    return [
        'status' => $statusCode,
        'body' => is_array($decodedResponse)
            ? $decodedResponse
            : ['raw' => $responseBody]
    ];
}

function normalizeBrazilianPhone(string $phone): string
{
    $digits = preg_replace('/\D+/', '', $phone) ?? '';

    /*
     * Telefone brasileiro sem código do país:
     * 10 dígitos = DDD + telefone fixo
     * 11 dígitos = DDD + celular
     */
    if (strlen($digits) === 10 || strlen($digits) === 11) {
        $digits = '55' . $digits;
    }

    return '+' . $digits;
}


/*
|--------------------------------------------------------------------------
| RECEBER E VALIDAR O FORMULÁRIO
|--------------------------------------------------------------------------
*/

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody ?: '', true);

if (!is_array($data)) {
    respond(400, [
        'success' => false,
        'message' => 'JSON inválido.'
    ]);
}

$nome = trim((string) ($data['nome'] ?? ''));
$empresa = trim((string) ($data['empresa'] ?? ''));
$email = trim((string) ($data['email'] ?? ''));
$telefone = trim((string) ($data['telefone'] ?? ''));

$cargo = trim((string) ($data['cargo'] ?? ''));

$produtoInteresse = trim(
    (string) ($data['produto_interesse'] ?? '')
);

$origem = trim(
    (string) ($data['origem'] ?? 'Landing Page Smart3DX')
);

$mensagem = trim(
    (string) ($data['mensagem'] ?? '')
);

if (mb_strlen($nome) < 2) {
    respond(422, [
        'success' => false,
        'message' => 'Nome inválido.'
    ]);
}

if ($empresa === '') {
    respond(422, [
        'success' => false,
        'message' => 'Empresa não informada.'
    ]);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, [
        'success' => false,
        'message' => 'E-mail inválido.'
    ]);
}

$phoneDigits = preg_replace('/\D+/', '', $telefone) ?? '';

if (strlen($phoneDigits) < 10) {
    respond(422, [
        'success' => false,
        'message' => 'Telefone inválido.'
    ]);
}

if (
    $kommoSubdomain === 'SEU_SUBDOMINIO'
    || $kommoToken === 'SEU_TOKEN_DE_LONGA_DURACAO'
) {
    respond(500, [
        'success' => false,
        'message' => 'A integração ainda não foi configurada.'
    ]);
}


/*
|--------------------------------------------------------------------------
| LOCALIZAR OS CAMPOS PADRÃO DE TELEFONE E E-MAIL
|--------------------------------------------------------------------------
|
| O ID desses campos muda entre contas do Kommo.
| Por isso, o código procura os campos automaticamente.
|
*/
function buildContactCustomField(
    array $field,
    string $value
): ?array {
    $value = trim($value);

    if ($value === '') {
        return null;
    }

    $fieldId = isset($field['id'])
        ? (int) $field['id']
        : 0;

    $fieldType = isset($field['type'])
        ? (string) $field['type']
        : '';

    if ($fieldId <= 0) {
        return null;
    }

    /*
     * Campos de seleção precisam receber o enum_id
     * correspondente à opção cadastrada no Kommo.
     */
    $selectTypes = [
        'select',
        'multiselect',
        'radiobutton'
    ];

    if (in_array($fieldType, $selectTypes, true)) {
        $enums = isset($field['enums'])
            && is_array($field['enums'])
            ? $field['enums']
            : [];

        foreach ($enums as $enum) {
            $enumValue = trim(
                (string) ($enum['value'] ?? '')
            );

            if (strcasecmp($enumValue, $value) === 0) {
                return [
                    'field_id' => $fieldId,
                    'values' => [
                        [
                            'enum_id' => (int) $enum['id']
                        ]
                    ]
                ];
            }
        }

        throw new RuntimeException(
            'A opção "' . $value
            . '" não existe no campo "'
            . ($field['name'] ?? 'desconhecido')
            . '" do Kommo.'
        );
    }

    /*
     * Campo de texto ou outro tipo que aceita
     * diretamente o valor.
     */
    return [
        'field_id' => $fieldId,
        'values' => [
            [
                'value' => $value
            ]
        ]
    ];
}

try {
    /*
    |--------------------------------------------------------------------------
    | LOCALIZAR TELEFONE E E-MAIL
    |--------------------------------------------------------------------------
    */

    $fieldsUrl =
        "https://{$kommoSubdomain}.kommo.com"
        . "/api/v4/contacts/custom_fields?limit=250";

    $fieldsResponse = kommoRequest(
        'GET',
        $fieldsUrl,
        $kommoToken
    );

    if (
        $fieldsResponse['status'] < 200
        || $fieldsResponse['status'] >= 300
    ) {
        respond(502, [
            'success' => false,
            'message' => 'Não foi possível consultar os campos do Kommo.',
            'kommo_status' => $fieldsResponse['status'],
            'kommo_response' => $fieldsResponse['body']
        ]);
    }

    $customFields =
        $fieldsResponse['body']['_embedded']['custom_fields']
        ?? [];

    $phoneFieldId = null;
    $emailFieldId = null;

    foreach ($customFields as $field) {
        $fieldCode = $field['code'] ?? null;

        if ($fieldCode === 'PHONE') {
            $phoneFieldId = (int) $field['id'];
        }

        if ($fieldCode === 'EMAIL') {
            $emailFieldId = (int) $field['id'];
        }
    }

    /*
     * Esta validação precisa ficar fora do foreach.
     */
    if (!$phoneFieldId || !$emailFieldId) {
        respond(500, [
            'success' => false,
            'message' =>
                'Os campos de telefone ou e-mail não foram encontrados.'
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | CONSULTAR CARGO PELO ID
    |--------------------------------------------------------------------------
    */

    $cargoFieldResponse = kommoRequest(
        'GET',
        "https://{$kommoSubdomain}.kommo.com"
        . "/api/v4/contacts/custom_fields/{$cargoFieldId}",
        $kommoToken
    );

    if (
        $cargoFieldResponse['status'] < 200
        || $cargoFieldResponse['status'] >= 300
    ) {
        respond(500, [
            'success' => false,
            'message' =>
                'O ID informado para o campo Cargo não é válido como campo de contato.',
            'field_id' => $cargoFieldId,
            'kommo_status' => $cargoFieldResponse['status'],
            'kommo_response' => $cargoFieldResponse['body']
        ]);
    }

    $cargoField = $cargoFieldResponse['body'];

    /*
    |--------------------------------------------------------------------------
    | CONSULTAR PRODUTO DE INTERESSE PELO ID
    |--------------------------------------------------------------------------
    */

    $produtoFieldResponse = kommoRequest(
        'GET',
        "https://{$kommoSubdomain}.kommo.com"
        . "/api/v4/contacts/custom_fields/{$produtoInteresseFieldId}",
        $kommoToken
    );

    if (
        $produtoFieldResponse['status'] < 200
        || $produtoFieldResponse['status'] >= 300
    ) {
        respond(500, [
            'success' => false,
            'message' =>
                'O ID informado para Produto de Interesse não é válido como campo de contato.',
            'field_id' => $produtoInteresseFieldId,
            'kommo_status' => $produtoFieldResponse['status'],
            'kommo_response' => $produtoFieldResponse['body']
        ]);
    }

    $produtoInteresseField =
        $produtoFieldResponse['body'];

    /*
    |--------------------------------------------------------------------------
    | MONTAR OS CAMPOS DO CONTATO
    |--------------------------------------------------------------------------
    */

    $contactCustomFields = [
        [
            'field_id' => $phoneFieldId,
            'values' => [
                [
                    'value' =>
                        normalizeBrazilianPhone($telefone),
                    'enum_code' => 'MOB'
                ]
            ]
        ],
        [
            'field_id' => $emailFieldId,
            'values' => [
                [
                    'value' => $email,
                    'enum_code' => 'WORK'
                ]
            ]
        ]
    ];

    /*
     * A função buildContactCustomField detecta se
     * o campo é texto ou seleção.
     */
    if ($cargo !== '') {
        $cargoCustomField =
            buildContactCustomField(
                $cargoField,
                $cargo
            );

        if ($cargoCustomField !== null) {
            $contactCustomFields[] =
                $cargoCustomField;
        }
    }

    if ($produtoInteresse !== '') {
        $produtoCustomField =
            buildContactCustomField(
                $produtoInteresseField,
                $produtoInteresse
            );

        if ($produtoCustomField !== null) {
            $contactCustomFields[] =
                $produtoCustomField;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | CRIAR LEAD, CONTATO E EMPRESA
    |--------------------------------------------------------------------------
    */

    $lead = [
        'name' => 'LP Orçamento | ' . $nome,
        'pipeline_id' => (int) $pipelineId,
        'status_id' => (int) $statusId,

        '_embedded' => [
            'contacts' => [
                [
                    'name' => $nome,
                    'custom_fields_values' =>
                        $contactCustomFields
                ]
            ],

            'companies' => [
                [
                    'name' => $empresa
                ]
            ],

            'tags' => [
                [
                    'name' => 'Landing Page'
                ],
                [
                    'name' => 'LP Orçamento'
                ],
                [
                    'name' => 'Smart3DX'
                ]
            ]
        ]
    ];

    if ($responsibleUserId > 0) {
        $lead['responsible_user_id'] =
            (int) $responsibleUserId;
    }

    $kommoUrl =
        "https://{$kommoSubdomain}.kommo.com"
        . "/api/v4/leads/complex";

    $kommoResponse = kommoRequest(
        'POST',
        $kommoUrl,
        $kommoToken,
        [$lead]
    );

    if (
        $kommoResponse['status'] < 200
        || $kommoResponse['status'] >= 300
    ) {
        respond(502, [
            'success' => false,
            'message' =>
                'O Kommo recusou o cadastro.',
            'kommo_status' =>
                $kommoResponse['status'],
            'kommo_response' =>
                $kommoResponse['body'],
            'campos_enviados' => [
                'cargo' => $cargo,
                'cargo_field_id' => $cargoFieldId,
                'produto_interesse' =>
                    $produtoInteresse,
                'produto_field_id' =>
                    $produtoInteresseFieldId
            ]
        ]);
    }

    $createdLead =
        $kommoResponse['body'][0] ?? [];

    respond(200, [
        'success' => true,
        'message' =>
            'Lead cadastrado com sucesso.',
        'lead_id' =>
            $createdLead['id'] ?? null,
        'contact_id' =>
            $createdLead['contact_id'] ?? null,
        'company_id' =>
            $createdLead['company_id'] ?? null,
        'merged' =>
            $createdLead['merged'] ?? false
    ]);

} catch (Throwable $error) {
    error_log(
        'Erro na integração com o Kommo: '
        . get_class($error)
        . ' - '
        . $error->getMessage()
    );

    respond(500, [
        'success' => false,
        'message' =>
            'Erro interno ao cadastrar o lead.',
        'debug' => [
            'tipo' =>
                get_class($error),
            'detalhe' =>
                $error->getMessage(),
            'arquivo' =>
                basename($error->getFile()),
            'linha' =>
                $error->getLine()
        ]
    ]);
}