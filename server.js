// Forçar atualização para a Koyeb
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
// Habilita o CORS para permitir que o seu site na Netlify comunique com este servidor
app.use(cors());
app.use(express.json());

// O nosso endpoint que recebe os eventos do site
app.post('/api/capi', async (req, res) => {
  const accessToken = process.env.FB_ACCESS_TOKEN;
  const pixelId = process.env.FB_PIXEL_ID;
  const testCode = process.env.FB_TEST_EVENT_CODE || null;

  if (!accessToken || !pixelId) {
    console.error("Variáveis de ambiente do Facebook não configuradas.");
    return res.status(500).json({ error: "Configuração do servidor incompleta." });
  }

  try {
    const payload = req.body;
    const { event_name, event_id, plan, action, utm, fbp, fbc, fbclid } = payload;

    if (!event_id) {
      return res.status(400).json({ error: "Missing event_id for deduplication" });
    }

    const now = Date.now();
    const _fbc = fbc || (fbclid ? `fb.1.${Math.floor(now / 1000)}.${fbclid}` : null);

    const serverPayload = {
      data: [
        {
          event_name,
          event_time: Math.floor(now / 1000),
          action_source: "website",
          event_id,
          event_source_url: req.headers.referer || '',
          user_data: {
            client_ip_address: req.ip,
            client_user_agent: req.headers['user-agent'],
            ...(fbp && { fbp }),
            ...(_fbc && { fbc: _fbc }),
          },
          custom_data: {
            ...(plan && { plan }),
            ...(action && { action }),
            ...(utm && { utm }),
          },
        },
      ],
      access_token: accessToken,
    };

    if (testCode) {
      serverPayload.test_event_code = testCode;
    }

    const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serverPayload),
    });

    const responseBody = await response.json();

    if (!response.ok) {
      console.error("Erro ao enviar evento para o Facebook:", responseBody);
      throw new Error("Falha ao enviar evento CAPI");
    }

    console.log("Evento enviado para a CAPI com sucesso. Resposta do Facebook:", responseBody);
    res.status(200).json({ success: true, message: "Evento processado.", fb_response: responseBody });

  } catch (error) {
    console.error("Erro no servidor CAPI:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor CAPI a correr na porta ${PORT}`);
});

