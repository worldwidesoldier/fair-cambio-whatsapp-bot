# 🚀 INSTRUÇÕES DE USO - BOT WHATSAPP FAIR CÂMBIO

## 📋 PRÉ-REQUISITOS

- Node.js versão 18 ou superior
- NPM ou Yarn
- WhatsApp instalado no celular
- Acesso à internet

## 🔧 INSTALAÇÃO

1. **Clone ou baixe o projeto**
```bash
cd whatsapp-baileys-bot
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
Edite o arquivo `.env`:
```env
# Números dos administradores (separados por vírgula)
ADMIN_NUMBERS=559185000000,559192000000

# Nome do bot
BOT_NAME=Fair Câmbio

# Nome da sessão
SESSION_NAME=fair-cambio-bot

# Horários de funcionamento
OPENING_HOUR=9
CLOSING_HOUR=18
SATURDAY_CLOSING=14

# Timezone
TZ=America/Sao_Paulo
```

## ▶️ INICIANDO O BOT

### Primeira vez (Desenvolvimento)
```bash
npm run dev
```

### Produção
```bash
npm start
```

## 📱 CONECTANDO AO WHATSAPP

1. Execute o comando de inicialização
2. Aparecerá um QR Code no terminal
3. Abra o WhatsApp no seu celular
4. Vá em **Dispositivos Conectados** > **Conectar Dispositivo**
5. Escaneie o QR Code exibido no terminal
6. Aguarde a mensagem: **"Bot conectado com sucesso!"**

## 🎯 FUNCIONALIDADES PARA CLIENTES

### Menu Principal
- **1** - Cotação do Dólar
- **2** - Cotação do Euro
- **3** - Outras moedas (10 moedas disponíveis)
- **4** - Nossos horários
- **5** - Nossas localizações
- **6** - Documentos necessários
- **7** - Falar com atendente
- **8** - Calcular conversão

### Palavras-chave
Os clientes também podem usar palavras-chave:
- `cotação`, `taxa`, `câmbio` - Para ver cotações
- `horário`, `funcionamento` - Para horários
- `endereço`, `onde`, `localização` - Para endereços
- `documento`, `documentos` - Para documentos necessários
- `atendente`, `humano` - Para falar com atendente
- `menu`, `oi`, `olá` - Para voltar ao menu

### Calculadora de Câmbio
1. Digite **8** ou **"calcular"**
2. Escolha a moeda (1-10)
3. Escolha operação: **1** (Comprar) ou **2** (Vender)
4. Digite o valor desejado
5. Receba o resultado calculado

## 👨‍💼 COMANDOS ADMINISTRATIVOS

### Gestão de Taxas
```
/atualizar [moeda] [tipo] [valor]
Exemplo: /atualizar dolar compra 5.20
```

```
/taxas
Mostra todas as taxas atuais
```

```
/historico [quantidade]
Mostra histórico de alterações
Exemplo: /historico 20
```

```
/estatisticas
Mostra estatísticas de variação das taxas
```

### Comunicação
```
/broadcast [mensagem]
Prepara mensagem em massa
Exemplo: /broadcast Novos horários de funcionamento!
```

```
/confirmar_broadcast
Confirma e envia o broadcast
```

```
/cancelar_broadcast
Cancela o broadcast pendente
```

### Sistema
```
/backup
Faz backup das taxas
```

```
/restaurar
Restaura último backup
```

```
/ajuda
Mostra menu de comandos admin
```

## ⚙️ CONFIGURAÇÕES

### Horários de Atendimento
Configurados no arquivo `.env`:
- **OPENING_HOUR**: Hora de abertura (padrão: 9)
- **CLOSING_HOUR**: Hora de fechamento (padrão: 18)
- **SATURDAY_CLOSING**: Fechamento no sábado (padrão: 14)

### Números Admin
Configure no `.env` separados por vírgula:
```env
ADMIN_NUMBERS=559185000000,559192000000
```

### Moedas e Taxas
Edite o arquivo `/src/config/rates.json` para:
- Adicionar/remover moedas
- Atualizar taxas de compra/venda
- Modificar emojis e nomes

### Localizações
Edite o arquivo `/src/config/branches.js` para:
- Adicionar/remover filiais
- Atualizar endereços e horários
- Modificar links do Google Maps

## 📊 MONITORAMENTO

### Logs
- Logs de chat: `/logs/chat-YYYY-MM-DD.json`
- Histórico de taxas: `/logs/rates-history.json`
- Logs do sistema: Console do terminal

### Sessões
- Sessão salva em: `/sessions/fair-cambio/`
- Reconexão automática em caso de desconexão
- Máximo 5 tentativas de reconexão

## 🔄 MANUTENÇÃO

### Atualizar Taxas Manualmente
1. Edite `/src/config/rates.json`
2. Modifique valores de `buy` e `sell`
3. Atualize `lastUpdate` com data/hora atual
4. Reinicie o bot ou use comando admin `/atualizar`

### Backup
- Execute `/backup` como admin
- Ou copie arquivos da pasta `/src/config/`

### Logs de Erro
Monitore o console para erros como:
- Problemas de conexão
- Mensagens não processadas
- Erros de validação

## 🚨 SOLUÇÃO DE PROBLEMAS

### Bot não conecta
1. Verifique internet
2. Tente escanear QR Code novamente
3. Verifique se WhatsApp não está conectado em outro lugar
4. Delete pasta `/sessions/` e reinicie

### Comandos admin não funcionam
1. Verifique se seu número está em `ADMIN_NUMBERS`
2. Use formato completo: `559185000000`
3. Comando deve começar com `/`

### Erro de inicialização
1. Execute `npm install`
2. Verifique Node.js versão 18+
3. Confira arquivo `.env`

### Mensagens não respondem
1. Verifique logs no console
2. Teste com comando `/ajuda` se for admin
3. Reinicie o bot

## 📞 SUPORTE

Para problemas técnicos:
1. Verifique logs no console
2. Consulte arquivo `RELATORIO_FINAL.md`
3. Teste funcionalidades uma por uma

## 🔐 SEGURANÇA

- ✅ Comandos admin protegidos por autenticação
- ✅ Validação de entradas para prevenir ataques
- ✅ Logs de ações administrativas
- ✅ Sessões seguras com criptografia

## 📱 EXEMPLO DE USO

### Cliente comum:
```
Cliente: oi
Bot: [Mensagem de boas-vindas + menu]

Cliente: 1
Bot: [Cotação do dólar]

Cliente: calcular
Bot: [Menu da calculadora]
```

### Administrador:
```
Admin: /taxas
Bot: [Todas as taxas atuais]

Admin: /atualizar dolar compra 5.25
Bot: [Confirmação da atualização]
```

---

## 🎉 BOT PRONTO PARA USO!

Siga estas instruções e seu bot WhatsApp Fair Câmbio estará operacional em minutos.