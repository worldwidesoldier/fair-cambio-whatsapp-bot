# WhatsApp Bot - Fair Câmbio 💱

Bot WhatsApp automatizado para casa de câmbio usando Baileys (sem necessidade de API oficial do Facebook).

## 🚀 Recursos Implementados

### Menu Interativo
- Cotações em tempo real (Dólar, Euro, outras moedas)
- Calculadora de conversão
- Horários de funcionamento
- Localizações das filiais
- Documentos necessários
- Atendimento humano

### Comandos Admin
- `/atualizar [moeda] [tipo] [valor]` - Atualiza taxas
- `/taxas` - Mostra todas as taxas
- `/estatisticas` - Estatísticas de variação
- `/historico` - Histórico de alterações
- `/broadcast` - Mensagem em massa
- `/ajuda` - Menu de ajuda admin

### Sistema Inteligente
- Detecção de palavras-chave
- Respostas contextuais
- Sessão persistente
- Reconexão automática
- Logs de conversas

## 📦 Instalação

1. **Clone o repositório**
```bash
cd whatsapp-baileys-bot
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o arquivo .env**
```env
ADMIN_NUMBERS=559185000000,559192000000
BOT_NAME=Fair Câmbio
SESSION_NAME=fair-cambio-bot
```

4. **Execute o bot**
```bash
npm start
```

5. **Escaneie o QR Code**
- Abra o WhatsApp no celular
- Vá em Configurações > Dispositivos conectados
- Clique em "Conectar dispositivo"
- Escaneie o QR Code que aparece no terminal

## 🏗️ Estrutura do Projeto

```
whatsapp-baileys-bot/
├── src/
│   ├── bot.js              # Arquivo principal
│   ├── config/
│   │   ├── branches.js     # Configuração das filiais
│   │   └── rates.json      # Taxas de câmbio
│   ├── handlers/
│   │   ├── menu.js         # Sistema de menu
│   │   ├── rates.js        # Gerenciamento de taxas
│   │   └── admin.js        # Comandos administrativos
│   └── utils/
│       ├── session.js      # Gerenciamento de sessões
│       └── formatter.js    # Formatação de mensagens
├── sessions/               # Sessões do WhatsApp
├── logs/                   # Logs de conversas
├── package.json
├── .env
└── README.md
```

## 💬 Exemplos de Uso

### Cliente comum:
```
Cliente: oi
Bot: Bom dia! Bem-vindo à FAIR CÂMBIO!
     [Menu interativo...]

Cliente: 1
Bot: [Cotação do dólar com valores de compra e venda]

Cliente: calcular
Bot: [Inicia calculadora de conversão]
```

### Administrador:
```
Admin: /atualizar dolar compra 5.25
Bot: ✅ Taxa atualizada com sucesso!
     Dólar Americano
     Compra: R$ 5,20 → R$ 5,25

Admin: /estatisticas
Bot: [Mostra estatísticas de variação das moedas]
```

## 🔧 Configuração de Múltiplas Filiais

Para ativar múltiplas filiais, edite `src/config/branches.js` e mude `active: true` para as filiais desejadas:

```javascript
{
  id: 'shopping-manauara',
  name: 'Fair Câmbio - Shopping Manauara',
  phone: '559185002345',
  active: true  // ← Mude para true
}
```

Depois execute uma instância do bot para cada número.

## 📊 Moedas Suportadas

- 💵 Dólar Americano (USD)
- 💶 Euro (EUR)
- 💷 Libra Esterlina (GBP)
- 🇦🇷 Peso Argentino (ARS)
- 🇵🇾 Guarani Paraguaio (PYG)
- 🇺🇾 Peso Uruguaio (UYU)
- 🇨🇱 Peso Chileno (CLP)
- 🇨🇦 Dólar Canadense (CAD)
- 🇨🇭 Franco Suíço (CHF)
- 🇯🇵 Iene Japonês (JPY)

## 🔒 Segurança

- Números admin configurados via .env
- Sessões criptografadas
- Logs locais de conversas
- Validação de comandos admin
- Sem exposição de dados sensíveis

## 🚨 Troubleshooting

### QR Code não aparece
- Verifique se a pasta `sessions` existe
- Delete a pasta `sessions` e tente novamente

### Bot desconecta frequentemente
- Verifique sua conexão com internet
- Aumente o timeout de reconexão em `bot.js`

### Comandos admin não funcionam
- Verifique se seu número está no .env
- Formato correto: 559185000000 (com código do país)

## 📈 Próximas Melhorias

- [ ] Dashboard web para administração
- [ ] Integração com API de cotações em tempo real
- [ ] Sistema de agendamento de câmbio
- [ ] Notificações push de variações
- [ ] Suporte a imagens e PDFs
- [ ] Relatórios automáticos

## 📝 Licença

Uso interno - Fair Câmbio

## 🤝 Suporte

Para suporte, entre em contato com o desenvolvedor ou abra uma issue.

---

Desenvolvido com ❤️ para Fair Câmbio