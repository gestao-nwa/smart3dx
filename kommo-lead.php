<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| SMART3DX | INTEGRAÇÃO DA LANDING PAGE DO EBOOK COM O KOMMO
|--------------------------------------------------------------------------
|
| Recebe o formulário da landing page e cria o lead no Kommo já com:
|
| - Contato, empresa e tags
| - Origem do lead (campo "Origem") definida automaticamente pelas UTMs
| - Campos de rastreio (utm_source, utm_medium, gclid, fbclid, etc.)
| - Uma nota com o detalhamento completo da origem
|
| Todo lead recebido é gravado em disco antes de ir para o Kommo.
| Assim, se o Kommo estiver fora do ar, nenhum lead se perde.
|
*/

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| A landing page é servida em http:// e em https://, com e sem www.
| Sem estes cabeçalhos, o navegador bloqueia o envio quando o visitante
| está em um endereço diferente do endereço do script.
|
| Esta era uma das causas dos formulários "pararem de funcionar sozinhos".
|
*/

$allowedOriginHosts = [
    'lp.smart3dx.com.br',
    'www.lp.smart3dx.com.br',
    'smart3dx.com.br',
    'www.smart3dx.com.br'
];

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($requestOrigin !== '') {
    $originHost = parse_url($requestOrigin, PHP_URL_HOST);

    if (is_string($originHost) && in_array($originHost, $allowedOriginHosts, true)) {
        header('Access-Control-Allow-Origin: ' . $requestOrigin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 86400');
    }
}

/*
 * Requisição de verificação enviada pelo navegador antes do POST.
 */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
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
| O token pode ficar fora deste arquivo.
| Crie um arquivo kommo-config.php ao lado deste, com:
|
| <?php return ['token' => 'SEU_TOKEN'];
|
| Se o arquivo existir, o token dele tem prioridade.
|
*/

$kommoSubdomain = 'smart3dx';
$kommoToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImViZjI3YmU4ZTBhZjBkYTdiYmM3MzFjMDNkYmFjNTZkMWM5NjMzNTllNjY0MzljZjA0MDQ3NjcwYzZlZmEwMDk1MWFjYjk5YzQzNjMwMDMyIn0.eyJhdWQiOiJhNmQ1Njg5Ni05YWUwLTRjOTktODhiNi0zZjk1YTY4NzE5MWYiLCJqdGkiOiJlYmYyN2JlOGUwYWYwZGE3YmJjNzMxYzAzZGJhYzU2ZDFjOTYzMzU5ZTY2NDM5Y2YwNDA0NzY3MGM2ZWZhMDA5NTFhY2I5OWM0MzYzMDAzMiIsImlhdCI6MTc4MzQ0OTA1OSwibmJmIjoxNzgzNDQ5MDU5LCJleHAiOjE5MjQ5MDU2MDAsInN1YiI6Ijg2OTEzNjUiLCJncmFudF90eXBlIjoiIiwiYWNjb3VudF9pZCI6MzY0MjU2NzEsImJhc2VfZG9tYWluIjoia29tbW8uY29tIiwidmVyc2lvbiI6Miwic2NvcGVzIjpbInB1c2hfbm90aWZpY2F0aW9ucyIsImZpbGVzIiwiY3JtIiwiZmlsZXNfZGVsZXRlIiwibm90aWZpY2F0aW9ucyJdLCJoYXNoX3V1aWQiOiJhNTA1NDYyNS1kNmY0LTRmZDEtOWQxMC02Mzg2NzI3NDBkODAiLCJhcGlfZG9tYWluIjoiYXBpLWcua29tbW8uY29tIn0.YB8eZhoSMx4cMx2-FGNv76Lm6_i5M83G2ESjlXh8aEPRMCD0zs6NWnSHsKgkQORFHcocOodmbRVqzZl7_sjIY8m-IovzRZiYKpL99I3bvFH1w1eVBoK8wbZw44Ydf_Vf3EijP5wUcQmVqU3UYW8-LoYVJoLkZX9QzA0kw6O6vEsSDMB_Playl4TErkYXzhzqJjSonI8MTMsJ5k6XuCfDSmCux6z9bVuR5TnW0KB-87v1FR5N2lVGZ_qf8NoOQcjifRSvRFPolgwLdKR4LTkeU6V9m01VM75xnuhn10BR5b__AYKD_BMXkhNG5gnopyOMMmfr8riIu_n9qQthafe1CQ';

$localConfigFile = __DIR__ . '/kommo-config.php';

if (is_readable($localConfigFile)) {
    $localConfig = require $localConfigFile;

    if (is_array($localConfig)) {
        $kommoSubdomain = (string) ($localConfig['subdomain'] ?? $kommoSubdomain);
        $kommoToken = (string) ($localConfig['token'] ?? $kommoToken);
    }
}

/*
|--------------------------------------------------------------------------
| DESTINO DO LEAD
|--------------------------------------------------------------------------
|
| Atenção:
| a etapa 105493519 ("Etapa de leads de entrada") é do tipo "leads de
| entrada". O Kommo não aceita criar leads diretamente nela pela API e
| move o lead automaticamente para a etapa seguinte, que é a "base".
|
| Por isso a etapa abaixo é declarada de forma explícita.
| Para que os leads da landing page caiam em "Prospecção", troque por
| 105493527.
|
*/

$pipelineId = 13669567;   // Inbound ( SDR )
$statusId   = 105493523;  // base

/*
 * O formulário do ebook não pede o cargo.
 * O campo fica configurado caso ele seja acrescentado.
 */
$cargoFieldId = 372690;            // Contato | Posição

/*
 * Coloque aqui o ID do campo de contato
 * Produto de Interesse.
 */
$produtoInteresseFieldId = 2440435;  // Contato | Produto de Interesse

/*
|--------------------------------------------------------------------------
| CAMPO "ORIGEM" DO LEAD
|--------------------------------------------------------------------------
|
| Campo de seleção do lead no Kommo.
| Os IDs abaixo servem como reserva: o script consulta as opções reais
| na API e só usa esta lista se a consulta falhar.
|
*/

$origemFieldId = 376128;

$origemEnumFallback = [
    'Anuncio Meta'     => 277396,
    'Anuncio Google'   => 277398,
    'Indicação'        => 277400,
    'Organico'         => 277402,
    'Lista SDR'        => 277404,
    'Anuncio Linkedin' => 1054550,
    'Anuncio TikTok'   => 1085374,
    'Landing Page'     => 1840573
];

$origemPadrao = 'Landing Page';

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
| PASTA DE REGISTRO
|--------------------------------------------------------------------------
|
| Todo lead recebido é gravado aqui antes da chamada ao Kommo.
| Se o Kommo recusar ou ficar fora do ar, o lead continua registrado
| em falhas.log e pode ser recuperado.
|
*/

$logDirectory = __DIR__ . '/kommo-logs';


/*
|--------------------------------------------------------------------------
| FUNÇÕES
|--------------------------------------------------------------------------
*/

/*
 * Sem declaração de tipo de retorno.
 * "never" só existe a partir do PHP 8.1 e a hospedagem roda 7.x.
 */
function respond(int $status, array $data)
{
    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    exit;
}

/**
 * Grava uma linha em um dos arquivos de registro.
 * Nunca interrompe o fluxo: registrar é importante, mas o lead é mais.
 */
function writeLog(string $directory, string $file, array $data): void
{
    try {
        if (!is_dir($directory)) {
            @mkdir($directory, 0750, true);
        }

        if (!is_dir($directory) || !is_writable($directory)) {
            return;
        }

        /*
         * Impede que os registros fiquem acessíveis pela web.
         */
        $protection = $directory . '/.htaccess';

        if (!file_exists($protection)) {
            @file_put_contents(
                $protection,
                "Require all denied\nDeny from all\n"
            );
        }

        $line = json_encode(
            ['data' => date('c')] + $data,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );

        if ($line === false) {
            return;
        }

        @file_put_contents(
            $directory . '/' . $file,
            $line . PHP_EOL,
            FILE_APPEND | LOCK_EX
        );
    } catch (Throwable $falhaDeRegistro) {
        // Registro é opcional. Seguir em frente.
    }
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

/**
 * Repete a chamada quando o Kommo responde com erro temporário
 * (limite de requisições ou instabilidade) ou quando a conexão cai.
 *
 * Sem isso, uma única instabilidade de rede perdia o lead.
 */
function kommoRequestWithRetry(
    string $method,
    string $url,
    string $token,
    ?array $body = null,
    int $attempts = 3
): array {
    $lastError = null;

    for ($attempt = 1; $attempt <= $attempts; $attempt++) {
        try {
            $response = kommoRequest($method, $url, $token, $body);

            $isTemporary =
                $response['status'] === 429
                || $response['status'] >= 500;

            if (!$isTemporary || $attempt === $attempts) {
                return $response;
            }
        } catch (Throwable $error) {
            $lastError = $error;

            if ($attempt === $attempts) {
                throw $error;
            }
        }

        /*
         * Espera 1s, depois 2s.
         */
        usleep($attempt * 1000000);
    }

    if ($lastError !== null) {
        throw $lastError;
    }

    throw new RuntimeException('Falha ao contatar o Kommo.');
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

function textValue($value, int $maxLength = 250): string
{
    if (is_array($value)) {
        $value = implode(', ', array_map('strval', $value));
    }

    $text = trim((string) $value);
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

    if (mb_strlen($text) > $maxLength) {
        $text = mb_substr($text, 0, $maxLength);
    }

    return $text;
}


/*
|--------------------------------------------------------------------------
| ORIGEM DO LEAD A PARTIR DAS UTMs
|--------------------------------------------------------------------------
|
| A origem é decidida aqui, no servidor, e não no navegador.
| Assim ela não depende de o visitante ter o JavaScript intacto.
|
*/

function detectOrigem(array $tracking, string $padrao): string
{
    $get = static function (string $key) use ($tracking): string {
        return mb_strtolower(trim((string) ($tracking[$key] ?? '')));
    };

    $source   = $get('utm_source');
    $medium   = $get('utm_medium');
    $referrer = $get('referrer');

    $has = static function (string $key) use ($tracking): bool {
        return trim((string) ($tracking[$key] ?? '')) !== '';
    };

    $contains = static function (string $haystack, array $needles): bool {
        foreach ($needles as $needle) {
            if ($haystack !== '' && strpos($haystack, $needle) !== false) {
                return true;
            }
        }

        return false;
    };

    /*
     * 1) Identificadores de clique em anúncio.
     *    São a prova mais confiável de tráfego pago.
     */
    if ($has('gclid') || $has('gbraid') || $has('wbraid') || $has('gad_source')) {
        return 'Anuncio Google';
    }

    if ($has('fbclid')) {
        return 'Anuncio Meta';
    }

    if ($has('ttclid')) {
        return 'Anuncio TikTok';
    }

    if ($has('li_fat_id')) {
        return 'Anuncio Linkedin';
    }

    /*
     * 2) Origem declarada pela UTM.
     *
     * Quem chega por busca ou por um link comum não traz utm_source.
     * Então, se a UTM existe, alguém marcou aquele link de propósito:
     * o padrão passa a ser a campanha da plataforma.
     *
     * Só volta a ser orgânico quando a própria mídia diz que não é
     * anúncio (link da bio, perfil, e-mail, busca orgânica).
     */
    $midiasNaoPagas = [
        'organic', 'organico', 'orgânico', 'seo', 'natural',
        'bio', 'linkbio', 'link-bio', 'linktree',
        'perfil', 'profile', 'post', 'postagem',
        'email', 'e-mail', 'mail', 'newsletter',
        'assinatura', 'signature', 'whatsapp', 'wpp'
    ];

    $naoPago = $contains($medium, $midiasNaoPagas);

    $sourceGroups = [
        'Anuncio Meta'     => ['facebook', 'fb', 'meta', 'instagram', 'ig'],
        'Anuncio Google'   => ['google', 'adwords', 'gdn', 'youtube', 'yt'],
        'Anuncio Linkedin' => ['linkedin'],
        'Anuncio TikTok'   => ['tiktok', 'tik_tok']
    ];

    foreach ($sourceGroups as $origem => $needles) {
        if ($contains($source, $needles)) {
            return $naoPago ? 'Organico' : $origem;
        }
    }

    /*
     * 3) Indicação e parcerias.
     */
    if (
        $contains($source, ['indica', 'parceir', 'partner', 'referral', 'indicacao'])
        || $contains($medium, ['indica', 'parceir', 'partner', 'referral'])
    ) {
        return 'Indicação';
    }

    /*
     * 4) Listas de prospecção ativa.
     */
    if ($contains($source, ['sdr', 'outbound', 'prospec'])
        || $contains($medium, ['sdr', 'outbound', 'prospec'])
    ) {
        return 'Lista SDR';
    }

    /*
     * 5) Tráfego orgânico declarado ou identificado pelo referenciador.
     */
    if ($contains($medium, ['organic', 'organico', 'orgânico', 'seo', 'social'])) {
        return 'Organico';
    }

    if ($source === '' && $medium === '') {
        $buscadores = [
            'google.', 'bing.', 'search.yahoo', 'duckduckgo',
            'ecosia.', 'yandex.', 'brave.com', 'perplexity.', 'chatgpt.'
        ];

        $redesSociais = [
            'facebook.', 'instagram.', 'linkedin.', 'tiktok.',
            'youtube.', 't.co', 'l.facebook', 'lm.facebook'
        ];

        if ($contains($referrer, $buscadores) || $contains($referrer, $redesSociais)) {
            return 'Organico';
        }
    }

    /*
     * 6) Acesso direto ou origem não reconhecida.
     */
    return $padrao;
}


/*
|--------------------------------------------------------------------------
| RECEBER E VALIDAR O FORMULÁRIO
|--------------------------------------------------------------------------
*/

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody ?: '', true);

/*
 * Alguns navegadores e bloqueadores alteram o corpo da requisição.
 * Neste caso, o formulário chega como POST comum.
 */
if (!is_array($data) && !empty($_POST)) {
    $data = $_POST;
}

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

$origemFormulario = trim(
    (string) ($data['origem'] ?? 'Landing Page Ebook CAD 3D')
);

$mensagem = trim(
    (string) ($data['mensagem'] ?? '')
);

/*
 * Dados de rastreio enviados pela landing page.
 * Podem vir agrupados em "tracking" ou soltos no corpo.
 */
$tracking = isset($data['tracking']) && is_array($data['tracking'])
    ? $data['tracking']
    : [];

$trackingKeys = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'gclid', 'gbraid', 'wbraid', 'gad_source', 'fbclid', 'ttclid',
    'li_fat_id', 'msclkid', 'referrer', 'landing_page', 'ga_client_id',
    'first_utm_source', 'first_utm_medium', 'first_utm_campaign',
    'first_referrer', 'first_landing_page', 'primeiro_acesso'
];

foreach ($trackingKeys as $key) {
    if (!isset($tracking[$key]) && isset($data[$key])) {
        $tracking[$key] = $data[$key];
    }
}

$tracking = array_map(
    function ($value) {
        return textValue($value, 500);
    },
    $tracking
);

/*
|--------------------------------------------------------------------------
| REDE DE SEGURANÇA PARA O RASTREIO
|--------------------------------------------------------------------------
|
| Se o envio não trouxe nenhuma UTM, elas são lidas do endereço da
| página que fez o envio, que o navegador informa no cabeçalho Referer.
|
| Isso cobre o visitante cujo navegador ainda tem uma versão antiga do
| main.js em cache, e qualquer página do site que ainda não tenha sido
| atualizada.
|
*/

$chavesDeRastreio = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'gclid', 'gbraid', 'wbraid', 'gad_source',
    'fbclid', 'ttclid', 'li_fat_id', 'msclkid'
];

$recebeuRastreio = false;

foreach ($chavesDeRastreio as $chave) {
    if (trim((string) ($tracking[$chave] ?? '')) !== '') {
        $recebeuRastreio = true;
        break;
    }
}

if (!$recebeuRastreio) {
    $paginaDeOrigem = (string) ($_SERVER['HTTP_REFERER'] ?? '');

    if ($paginaDeOrigem !== '') {
        $queryDaPagina = (string) parse_url($paginaDeOrigem, PHP_URL_QUERY);

        if ($queryDaPagina !== '') {
            $parametrosDaPagina = [];
            parse_str($queryDaPagina, $parametrosDaPagina);

            foreach ($chavesDeRastreio as $chave) {
                if (isset($parametrosDaPagina[$chave])) {
                    $tracking[$chave] = textValue(
                        $parametrosDaPagina[$chave],
                        500
                    );
                }
            }
        }

        if (trim((string) ($tracking['landing_page'] ?? '')) === '') {
            $tracking['landing_page'] = textValue($paginaDeOrigem, 500);
        }
    }
}

/*
 * Registro imediato: o lead existe em disco antes de qualquer
 * chamada externa.
 */
writeLog($logDirectory, 'recebidos.log', [
    'nome' => $nome,
    'email' => $email,
    'empresa' => $empresa,
    'telefone' => $telefone,
    'cargo' => $cargo,
    'produto_interesse' => $produtoInteresse,
    'origem_formulario' => $origemFormulario,
    'mensagem' => $mensagem,
    'tracking' => $tracking,
    'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
]);

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

$origemDetectada = detectOrigem($tracking, $origemPadrao);


/*
|--------------------------------------------------------------------------
| CAMPOS PERSONALIZADOS
|--------------------------------------------------------------------------
|
| O ID dos campos padrão de telefone e e-mail muda entre contas do Kommo.
| Por isso o script procura os campos automaticamente e guarda o
| resultado em cache, para não repetir as consultas a cada envio.
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

        /*
         * A opção não existe no Kommo.
         *
         * Antes o script interrompia o cadastro e o lead era perdido.
         * Agora o campo é apenas ignorado: o valor segue registrado
         * na nota do lead.
         */
        return null;
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

/**
 * Lê a estrutura dos campos do Kommo com cache em disco.
 * Reduz de quatro para uma as chamadas à API em cada envio.
 */
function loadFieldCatalog(
    string $subdomain,
    string $token,
    string $logDirectory
): array {
    $cacheFile = sys_get_temp_dir()
        . '/kommo-campos-' . md5($subdomain) . '.json';

    $cacheLifetime = 6 * 3600;

    if (
        is_readable($cacheFile)
        && (time() - (int) filemtime($cacheFile)) < $cacheLifetime
    ) {
        $cached = json_decode(
            (string) file_get_contents($cacheFile),
            true
        );

        if (is_array($cached) && isset($cached['contacts'], $cached['leads'])) {
            return $cached;
        }
    }

    $catalog = [
        'contacts' => [],
        'leads' => []
    ];

    foreach (['contacts', 'leads'] as $entity) {
        $response = kommoRequestWithRetry(
            'GET',
            "https://{$subdomain}.kommo.com"
            . "/api/v4/{$entity}/custom_fields?limit=250",
            $token
        );

        if ($response['status'] < 200 || $response['status'] >= 300) {
            throw new RuntimeException(
                'Não foi possível consultar os campos de '
                . $entity . ' no Kommo. HTTP '
                . $response['status']
            );
        }

        $fields = $response['body']['_embedded']['custom_fields'] ?? [];

        foreach ($fields as $field) {
            if (!isset($field['id'])) {
                continue;
            }

            $catalog[$entity][(string) $field['id']] = [
                'id' => (int) $field['id'],
                'name' => (string) ($field['name'] ?? ''),
                'code' => $field['code'] ?? null,
                'type' => (string) ($field['type'] ?? ''),
                'enums' => array_map(
                    function (array $enum) {
                        return [
                            'id' => (int) ($enum['id'] ?? 0),
                            'value' => (string) ($enum['value'] ?? '')
                        ];
                    },
                    is_array($field['enums'] ?? null) ? $field['enums'] : []
                )
            ];
        }
    }

    @file_put_contents(
        $cacheFile,
        json_encode($catalog, JSON_UNESCAPED_UNICODE)
    );

    return $catalog;
}

/**
 * Grava campos do tipo "seleção" no lead e confere se foram aceitos.
 *
 * Logo após a criação, o Kommo ainda está processando o lead e às vezes
 * descarta a atualização mesmo respondendo 200. Por isso a gravação é
 * conferida e repetida.
 */
function saveLeadSelectFields(
    string $subdomain,
    string $token,
    int $leadId,
    array $fields,
    int $checkFieldId,
    int $attempts = 3
): bool {
    $leadUrl = "https://{$subdomain}.kommo.com/api/v4/leads/{$leadId}";

    for ($attempt = 1; $attempt <= $attempts; $attempt++) {
        /*
         * Pequena pausa para o Kommo terminar de processar o lead.
         */
        usleep(600000);

        kommoRequestWithRetry(
            'PATCH',
            $leadUrl,
            $token,
            [
                'custom_fields_values' => $fields
            ],
            2
        );

        $check = kommoRequestWithRetry('GET', $leadUrl, $token, null, 2);

        if ($check['status'] < 200 || $check['status'] >= 300) {
            continue;
        }

        $saved = $check['body']['custom_fields_values'] ?? [];

        if (!is_array($saved)) {
            continue;
        }

        foreach ($saved as $field) {
            if ((int) ($field['field_id'] ?? 0) === $checkFieldId) {
                return true;
            }
        }
    }

    return false;
}

function findFieldByCode(array $fields, string $code): ?array
{
    foreach ($fields as $field) {
        if (($field['code'] ?? null) === $code) {
            return $field;
        }
    }

    return null;
}


try {
    $catalog = loadFieldCatalog(
        $kommoSubdomain,
        $kommoToken,
        $logDirectory
    );

    $contactFields = $catalog['contacts'];
    $leadFields = $catalog['leads'];

    /*
    |--------------------------------------------------------------------------
    | TELEFONE E E-MAIL
    |--------------------------------------------------------------------------
    */

    $phoneField = findFieldByCode($contactFields, 'PHONE');
    $emailField = findFieldByCode($contactFields, 'EMAIL');

    if ($phoneField === null || $emailField === null) {
        respond(500, [
            'success' => false,
            'message' =>
                'Os campos de telefone ou e-mail não foram encontrados.'
        ]);
    }

    $contactCustomFields = [
        [
            'field_id' => $phoneField['id'],
            'values' => [
                [
                    'value' =>
                        normalizeBrazilianPhone($telefone),
                    'enum_code' => 'MOB'
                ]
            ]
        ],
        [
            'field_id' => $emailField['id'],
            'values' => [
                [
                    'value' => $email,
                    'enum_code' => 'WORK'
                ]
            ]
        ]
    ];

    /*
    |--------------------------------------------------------------------------
    | CARGO E PRODUTO DE INTERESSE
    |--------------------------------------------------------------------------
    |
    | Se o campo não existir mais no Kommo, o lead continua sendo criado.
    | O valor fica registrado na nota.
    |
    */

    $cargoField = $contactFields[(string) $cargoFieldId] ?? null;
    $produtoInteresseField = $contactFields[(string) $produtoInteresseFieldId] ?? null;

    if ($cargo !== '' && $cargoField !== null) {
        $cargoCustomField = buildContactCustomField($cargoField, $cargo);

        if ($cargoCustomField !== null) {
            $contactCustomFields[] = $cargoCustomField;
        }
    }

    if ($produtoInteresse !== '' && $produtoInteresseField !== null) {
        $produtoCustomField = buildContactCustomField(
            $produtoInteresseField,
            $produtoInteresse
        );

        if ($produtoCustomField !== null) {
            $contactCustomFields[] = $produtoCustomField;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | ORIGEM E RASTREIO NO LEAD
    |--------------------------------------------------------------------------
    */

    $leadCustomFields = [];

    $origemField = $leadFields[(string) $origemFieldId] ?? null;

    $origemEnumId = null;

    if ($origemField !== null) {
        foreach ($origemField['enums'] as $enum) {
            if (strcasecmp($enum['value'], $origemDetectada) === 0) {
                $origemEnumId = $enum['id'];
                break;
            }
        }
    }

    if ($origemEnumId === null) {
        $origemEnumId = $origemEnumFallback[$origemDetectada] ?? null;
    }

    /*
     * O endpoint /leads/complex descarta silenciosamente campos do
     * tipo "seleção". Por isso a Origem é gravada logo depois, com
     * uma atualização do lead recém-criado.
     */
    $leadSelectFields = [];

    if ($origemEnumId !== null) {
        $leadSelectFields[] = [
            'field_id' => $origemFieldId,
            'values' => [
                [
                    'enum_id' => (int) $origemEnumId
                ]
            ]
        ];
    }

    /*
     * Campos de rastreio nativos do Kommo.
     * A chave é o código do campo; o valor, a chave enviada pela página.
     */
    $trackingFieldMap = [
        'UTM_SOURCE'   => 'utm_source',
        'UTM_MEDIUM'   => 'utm_medium',
        'UTM_CAMPAIGN' => 'utm_campaign',
        'UTM_CONTENT'  => 'utm_content',
        'UTM_TERM'     => 'utm_term',
        'UTM_REFERRER' => 'first_referrer',
        'REFERRER'     => 'referrer',
        'GCLID'        => 'gclid',
        'FBCLID'       => 'fbclid',
        'GCLIENTID'    => 'ga_client_id'
    ];

    foreach ($trackingFieldMap as $fieldCode => $trackingKey) {
        $value = textValue($tracking[$trackingKey] ?? '');

        if ($value === '') {
            continue;
        }

        $field = findFieldByCode($leadFields, $fieldCode);

        if ($field === null) {
            continue;
        }

        $leadCustomFields[] = [
            'field_id' => $field['id'],
            'values' => [
                [
                    'value' => $value
                ]
            ]
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | NOTA COM O DETALHAMENTO DA ORIGEM
    |--------------------------------------------------------------------------
    */

    $notaLinhas = [
        'Lead recebido pela landing page do ebook.',
        '',
        'Origem definida: ' . $origemDetectada,
        'Formulário: ' . ($origemFormulario !== '' ? $origemFormulario : '-'),
        'Cargo: ' . ($cargo !== '' ? $cargo : '-'),
        'Produto de interesse: '
            . ($produtoInteresse !== '' ? $produtoInteresse : '-')
    ];

    if ($mensagem !== '') {
        $notaLinhas[] = 'Observação: ' . $mensagem;
    }

    $notaLinhas[] = '';
    $notaLinhas[] = '--- Rastreio ---';

    $notaCampos = [
        'utm_source' => 'utm_source',
        'utm_medium' => 'utm_medium',
        'utm_campaign' => 'utm_campaign',
        'utm_content' => 'utm_content',
        'utm_term' => 'utm_term',
        'gclid' => 'gclid',
        'fbclid' => 'fbclid',
        'ttclid' => 'ttclid',
        'msclkid' => 'msclkid',
        'li_fat_id' => 'li_fat_id',
        'gad_source' => 'gad_source',
        'referenciador' => 'referrer',
        'pagina de entrada' => 'landing_page',
        'primeira origem' => 'first_utm_source',
        'primeira midia' => 'first_utm_medium',
        'primeira campanha' => 'first_utm_campaign',
        'primeiro referenciador' => 'first_referrer',
        'primeiro acesso' => 'primeiro_acesso'
    ];

    $temRastreio = false;

    foreach ($notaCampos as $rotulo => $chave) {
        $valor = textValue($tracking[$chave] ?? '');

        if ($valor === '') {
            continue;
        }

        $temRastreio = true;
        $notaLinhas[] = $rotulo . ': ' . $valor;
    }

    if (!$temRastreio) {
        $notaLinhas[] = 'Nenhuma UTM recebida (acesso direto).';
    }

    $notaTexto = implode("\n", $notaLinhas);

    /*
    |--------------------------------------------------------------------------
    | CRIAR LEAD, CONTATO E EMPRESA
    |--------------------------------------------------------------------------
    */

    $tags = [
        ['name' => 'Landing Page'],
        ['name' => 'Ebook CAD 3D'],
        ['name' => 'Smart3DX'],
        ['name' => 'Origem: ' . $origemDetectada]
    ];

    $campanha = textValue($tracking['utm_campaign'] ?? '', 60);

    if ($campanha !== '') {
        $tags[] = ['name' => 'Campanha: ' . $campanha];
    }

    $lead = [
        'name' => 'Ebook CAD 3D | ' . $nome,
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

            'tags' => $tags
        ]
    ];

    if ($leadCustomFields !== []) {
        $lead['custom_fields_values'] = $leadCustomFields;
    }

    if ($responsibleUserId > 0) {
        $lead['responsible_user_id'] =
            (int) $responsibleUserId;
    }

    $kommoUrl =
        "https://{$kommoSubdomain}.kommo.com"
        . "/api/v4/leads/complex";

    $kommoResponse = kommoRequestWithRetry(
        'POST',
        $kommoUrl,
        $kommoToken,
        [$lead]
    );

    if (
        $kommoResponse['status'] < 200
        || $kommoResponse['status'] >= 300
    ) {
        writeLog($logDirectory, 'falhas.log', [
            'motivo' => 'kommo_recusou',
            'kommo_status' => $kommoResponse['status'],
            'kommo_response' => $kommoResponse['body'],
            'lead' => $lead
        ]);

        respond(502, [
            'success' => false,
            'message' =>
                'O Kommo recusou o cadastro.',
            'kommo_status' =>
                $kommoResponse['status']
        ]);
    }

    $createdLead =
        $kommoResponse['body'][0] ?? [];

    $leadId = isset($createdLead['id'])
        ? (int) $createdLead['id']
        : 0;

    /*
     * Grava a Origem no lead recém-criado.
     * Se falhar, o lead já existe e a origem continua registrada
     * na tag e na nota.
     */
    if ($leadId > 0 && $leadSelectFields !== []) {
        try {
            $origemGravada = saveLeadSelectFields(
                $kommoSubdomain,
                $kommoToken,
                $leadId,
                $leadSelectFields,
                $origemFieldId
            );

            if (!$origemGravada) {
                writeLog($logDirectory, 'falhas.log', [
                    'motivo' => 'origem_nao_gravada',
                    'lead_id' => $leadId,
                    'origem' => $origemDetectada
                ]);
            }
        } catch (Throwable $origemError) {
            error_log(
                'Kommo: lead criado, origem não gravada. '
                . $origemError->getMessage()
            );
        }
    }

    /*
     * A nota é um complemento.
     * Se falhar, o lead já está criado e o envio continua válido.
     */
    if ($leadId > 0) {
        try {
            kommoRequestWithRetry(
                'POST',
                "https://{$kommoSubdomain}.kommo.com"
                . "/api/v4/leads/{$leadId}/notes",
                $kommoToken,
                [
                    [
                        'note_type' => 'common',
                        'params' => [
                            'text' => $notaTexto
                        ]
                    ]
                ],
                2
            );
        } catch (Throwable $noteError) {
            error_log(
                'Kommo: lead criado, nota não registrada. '
                . $noteError->getMessage()
            );
        }
    }

    writeLog($logDirectory, 'enviados.log', [
        'lead_id' => $leadId,
        'nome' => $nome,
        'email' => $email,
        'origem' => $origemDetectada
    ]);

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
            $createdLead['merged'] ?? false,
        'origem' => $origemDetectada
    ]);

} catch (Throwable $error) {
    error_log(
        'Erro na integração com o Kommo: '
        . get_class($error)
        . ' - '
        . $error->getMessage()
    );

    writeLog($logDirectory, 'falhas.log', [
        'motivo' => 'excecao',
        'tipo' => get_class($error),
        'detalhe' => $error->getMessage(),
        'arquivo' => basename($error->getFile()),
        'linha' => $error->getLine(),
        'nome' => $nome,
        'email' => $email,
        'empresa' => $empresa,
        'telefone' => $telefone,
        'origem' => $origemDetectada ?? null,
        'tracking' => $tracking
    ]);

    respond(500, [
        'success' => false,
        'message' =>
            'Erro interno ao cadastrar o lead.'
    ]);
}
