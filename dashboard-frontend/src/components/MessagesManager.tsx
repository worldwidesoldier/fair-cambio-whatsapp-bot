import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare, Edit, Save, X, RefreshCw, Eye, Copy,
  CheckCircle, AlertCircle, Clock, FileText, Phone,
  MapPin, DollarSign, Users, Settings, Smartphone
} from 'lucide-react';
import { io } from 'socket.io-client';

interface MessageTemplate {
  template: string;
  variables: Record<string, string>;
  lastUpdated?: string;
}

interface MessagesData {
  messages: Record<string, MessageTemplate>;
  branches: any;
  rates: any;
  lastUpdated: string;
}

interface MessageCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const messageCategories: MessageCategory[] = [
  {
    id: 'welcome',
    title: 'Boas-vindas',
    description: 'Primeira mensagem quando cliente inicia conversa',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'bg-green-500'
  },
  {
    id: 'menu',
    title: 'Menu Principal',
    description: 'Menu de opções do bot',
    icon: <Settings className="h-4 w-4" />,
    color: 'bg-blue-500'
  },
  {
    id: 'hours',
    title: 'Horários',
    description: 'Horários de funcionamento das filiais',
    icon: <Clock className="h-4 w-4" />,
    color: 'bg-orange-500'
  },
  {
    id: 'locations',
    title: 'Localizações',
    description: 'Endereços e informações das filiais',
    icon: <MapPin className="h-4 w-4" />,
    color: 'bg-red-500'
  },
  {
    id: 'documents',
    title: 'Documentos',
    description: 'Documentos necessários para câmbio',
    icon: <FileText className="h-4 w-4" />,
    color: 'bg-purple-500'
  },
  {
    id: 'purchase_process',
    title: 'Processo de Compra',
    description: 'Como funciona a compra de moedas',
    icon: <DollarSign className="h-4 w-4" />,
    color: 'bg-emerald-500'
  },
  {
    id: 'attendant',
    title: 'Atendimento',
    description: 'Conexão com atendentes humanos',
    icon: <Users className="h-4 w-4" />,
    color: 'bg-indigo-500'
  },
  {
    id: 'error',
    title: 'Erro/Não Entendido',
    description: 'Mensagem quando não compreende',
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'bg-gray-500'
  }
];

export default function MessagesManager() {
  const [messagesData, setMessagesData] = useState<MessagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editTemplate, setEditTemplate] = useState('');
  const [editVariables, setEditVariables] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Record<string, Date>>({});
  const [previewCategory, setPreviewCategory] = useState<string | null>(null);

  useEffect(() => {
    loadMessages();

    // Connect to WebSocket for real-time updates
    const socket = io('http://localhost:3001');

    socket.on('messageUpdated', (data) => {
      console.log('Mensagem atualizada via WebSocket:', data);
      loadMessages(); // Reload messages when updated
    });

    socket.on('reloadMessages', () => {
      console.log('Reload de mensagens solicitado via WebSocket');
      loadMessages();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const loadMessages = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/messages');
      const data = await response.json();
      setMessagesData(data);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      setLoading(false);
    }
  };

  const startEditing = (categoryId: string) => {
    const category = messagesData?.messages[categoryId];
    if (category) {
      setEditingCategory(categoryId);
      setEditTemplate(category.template || '');
      setEditVariables(category.variables || {});
    }
  };

  const cancelEditing = () => {
    setEditingCategory(null);
    setEditTemplate('');
    setEditVariables({});
  };

  const saveMessage = async (categoryId: string) => {
    setSaving(true);
    try {
      const response = await fetch(`http://localhost:3001/api/messages/${categoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: editTemplate,
          variables: editVariables
        })
      });

      if (response.ok) {
        await loadMessages();
        setLastSaved({ ...lastSaved, [categoryId]: new Date() });
        setEditingCategory(null);
        setEditTemplate('');
        setEditVariables({});
      }
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
    }
    setSaving(false);
  };

  const formatMessage = (template: string, variables: Record<string, string>) => {
    let formatted = template;
    Object.entries(variables).forEach(([key, value]) => {
      formatted = formatted.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return formatted;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando mensagens...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Mensagens</h2>
          <p className="text-muted-foreground">
            Configure todas as respostas automáticas do bot WhatsApp
          </p>
        </div>
        <Button onClick={loadMessages} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Recarregar
        </Button>
      </div>

      <div className="grid gap-6">
        {messageCategories.map((category) => {
          const messageData = messagesData?.messages[category.id];
          const isEditing = editingCategory === category.id;
          const isPreviewing = previewCategory === category.id;

          return (
            <Card key={category.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${category.color} text-white`}>
                      {category.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{category.title}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {lastSaved[category.id] && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Salvo {lastSaved[category.id].toLocaleTimeString()}
                      </Badge>
                    )}
                    {!isEditing && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewCategory(isPreviewing ? null : category.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(category.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor={`template-${category.id}`}>Template da Mensagem</Label>
                      <Textarea
                        id={`template-${category.id}`}
                        value={editTemplate}
                        onChange={(e) => setEditTemplate(e.target.value)}
                        placeholder="Digite o template da mensagem..."
                        className="min-h-[120px] mt-1 font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use {'{{variavel}}'} para inserir variáveis dinâmicas
                      </p>
                    </div>

                    {Object.keys(editVariables).length > 0 && (
                      <div>
                        <Label>Variáveis</Label>
                        <div className="space-y-2 mt-2">
                          {Object.entries(editVariables).map(([key, value]) => (
                            <div key={key} className="flex items-center space-x-2">
                              <Label className="text-xs w-24">{key}:</Label>
                              <Input
                                value={value}
                                onChange={(e) => setEditVariables({
                                  ...editVariables,
                                  [key]: e.target.value
                                })}
                                className="text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end space-x-2">
                      <Button variant="ghost" size="sm" onClick={cancelEditing}>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveMessage(category.id)}
                        disabled={saving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messageData?.template && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-medium">Template Atual</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(messageData.template)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="bg-muted p-3 rounded-md">
                          <pre className="text-xs whitespace-pre-wrap font-mono">
                            {messageData.template}
                          </pre>
                        </div>
                      </div>
                    )}

                    {isPreviewing && messageData?.template && (
                      <div>
                        <Label className="text-sm font-medium">Preview da Mensagem</Label>
                        <div className="bg-green-50 border border-green-200 p-3 rounded-md mt-2">
                          <div className="flex items-start space-x-2">
                            <Smartphone className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                            <div className="text-sm whitespace-pre-wrap">
                              {formatMessage(messageData.template, messageData.variables || {})}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {messageData?.lastUpdated && (
                      <p className="text-xs text-muted-foreground">
                        Última atualização: {new Date(messageData.lastUpdated).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}