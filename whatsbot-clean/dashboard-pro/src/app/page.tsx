'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Smartphone, Activity, DollarSign, Users, Zap, RefreshCw, QrCode, CheckCircle, XCircle, Clock } from 'lucide-react'
// import { QRCodeSVG } from 'qrcode.react'

interface BotStatus {
  status: string
  connected: boolean
  qrGenerated: boolean
  qrCode?: string
  reconnectAttempts: number
  timestamp: string
}

interface Rates {
  currencies: {
    [key: string]: {
      name: string
      emoji: string
      buy: number
      sell: number
    }
  }
  lastUpdate: string
}

export default function Dashboard() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [rates, setRates] = useState<Rates | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/status')
      const data = await response.json()
      setBotStatus(data)
    } catch (error) {
      console.error('Erro ao buscar status:', error)
      setBotStatus({
        status: 'disconnected',
        connected: false,
        qrGenerated: false,
        reconnectAttempts: 0,
        timestamp: new Date().toISOString()
      })
    }
  }

  const fetchRates = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/rates')
      const data = await response.json()
      setRates(data)
    } catch (error) {
      console.error('Erro ao buscar taxas:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchStatus(), fetchRates()])
      setLoading(false)
    }

    loadData()

    // Auto refresh a cada 3 segundos
    const interval = setInterval(() => {
      fetchStatus()
    }, 3000)

    // Refresh taxas a cada 30 segundos
    const ratesInterval = setInterval(() => {
      fetchRates()
    }, 30000)

    return () => {
      clearInterval(interval)
      clearInterval(ratesInterval)
    }
  }, [])

  const getStatusIcon = () => {
    if (!botStatus) return <Clock className="h-4 w-4" />

    if (botStatus.connected) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else if (botStatus.qrGenerated) {
      return <QrCode className="h-4 w-4 text-yellow-500" />
    } else {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusText = () => {
    if (!botStatus) return 'Carregando...'

    if (botStatus.connected) {
      return 'Conectado e Ativo'
    } else if (botStatus.qrGenerated) {
      return 'QR Code Gerado - Escaneie no WhatsApp'
    } else {
      return 'Desconectado - Conectando...'
    }
  }

  const getStatusColor = () => {
    if (!botStatus) return 'border-gray-200'

    if (botStatus.connected) {
      return 'border-green-200 bg-green-50'
    } else if (botStatus.qrGenerated) {
      return 'border-yellow-200 bg-yellow-50'
    } else {
      return 'border-red-200 bg-red-50'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <RefreshCw className="h-8 w-8 animate-spin text-white" />
          <span className="text-white text-xl">Carregando Dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-green-500 rounded-lg">
              <Smartphone className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">WhatsBot Dashboard</h1>
              <p className="text-slate-300">Controle Profissional do seu Chatbot</p>
            </div>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className={`transition-all duration-300 ${getStatusColor()}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status da Conexão</CardTitle>
              {getStatusIcon()}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getStatusText()}</div>
              {botStatus && (
                <p className="text-xs text-muted-foreground mt-1">
                  Última verificação: {new Date(botStatus.timestamp).toLocaleTimeString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tentativas de Reconexão</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{botStatus?.reconnectAttempts || 0}</div>
              <p className="text-xs text-muted-foreground">
                {botStatus?.reconnectAttempts === 0 ? 'Estável' : 'Reconectando...'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Moedas Disponíveis</CardTitle>
              <DollarSign className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {rates ? Object.keys(rates.currencies).length : 'Carregando...'}
              </div>
              <p className="text-xs text-muted-foreground">
                Câmbio em tempo real
              </p>
            </CardContent>
          </Card>

          <Card className="bg-cyan-50 border-cyan-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sistema</CardTitle>
              <Zap className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Online</div>
              <p className="text-xs text-muted-foreground">
                Versão Clean 1.0
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* QR Code Section */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <QrCode className="h-5 w-5" />
                <span>Conectar WhatsApp</span>
              </CardTitle>
              <CardDescription>
                {botStatus?.connected
                  ? 'WhatsApp conectado com sucesso!'
                  : 'Escaneie o QR Code abaixo com seu WhatsApp'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {botStatus?.connected ? (
                <div className="flex flex-col items-center space-y-4 p-8">
                  <div className="p-4 bg-green-100 rounded-full">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-green-700">Conectado!</h3>
                    <p className="text-sm text-gray-600">Seu bot está ativo e funcionando</p>
                  </div>
                </div>
              ) : botStatus?.qrGenerated ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="text-center">
                      <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">QR Code Disponível</h3>
                      <p className="text-sm text-gray-600 max-w-md">
                        O QR Code está sendo exibido no terminal do bot.<br/>
                        Verifique o console onde o bot está rodando para escaneá-lo com seu WhatsApp.
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      1. Abra o WhatsApp no seu celular<br/>
                      2. Toque em Menu → Dispositivos conectados<br/>
                      3. Toque em "Conectar um dispositivo"<br/>
                      4. Escaneie o QR Code do terminal
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4 p-8">
                  <div className="p-4 bg-gray-100 rounded-full">
                    <RefreshCw className="h-16 w-16 text-gray-400 animate-spin" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-700">Gerando QR Code...</h3>
                    <p className="text-sm text-gray-600">Aguarde um momento</p>
                  </div>
                </div>
              )}
              <div className="flex space-x-2">
                <Button
                  onClick={fetchStatus}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Status
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Rates Section */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Taxas de Câmbio</span>
              </CardTitle>
              <CardDescription>
                Cotações atuais das moedas disponíveis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rates ? (
                <div className="space-y-3">
                  {Object.entries(rates.currencies).map(([code, currency]) => (
                    <div
                      key={code}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{currency.emoji}</span>
                        <div>
                          <h4 className="font-medium">{currency.name}</h4>
                          <p className="text-sm text-gray-500">{code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          <span className="text-green-600 font-medium">
                            Compra: R$ {currency.buy.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-red-600 font-medium">
                            Venda: R$ {currency.sell.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="text-center text-sm text-gray-500 pt-2">
                    Última atualização: {new Date(rates.lastUpdate).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">Carregando taxas...</p>
                </div>
              )}
              <Button
                onClick={fetchRates}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar Taxas
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-slate-400">
            WhatsBot Clean v1.0 - Dashboard Profissional •
            <span className="ml-2">
              🚀 Powered by Next.js + ShadCN UI
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
