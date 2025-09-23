import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Save, Eye, RefreshCw } from 'lucide-react';

interface MessageTemplate {
  template: string;
  variables: Record<string, string>;
  lastUpdated?: string;
}

interface MessagesData {
  messages: Record<string, MessageTemplate>;
  lastUpdated: string;
}

export default function SimpleMessagesDemo() {
  const [messagesData, setMessagesData] = useState<MessagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editTemplate, setEditTemplate] = useState('');
  const [saving, setSaving] = useState(false);

  const categories = [
    { id: 'welcome', title: 'Boas-vindas', description: 'Primeira mensagem' },
    { id: 'menu', title: 'Menu Principal', description: 'Menu de opções' },
    { id: 'hours', title: 'Horários', description: 'Horários de funcionamento' },
    { id: 'locations', title: 'Localizações', description: 'Endereços das filiais' },
    { id: 'documents', title: 'Documentos', description: 'Documentos necessários' },
    { id: 'purchase_process', title: 'Processo de Compra', description: 'Como funciona' },
    { id: 'attendant', title: 'Atendimento', description: 'Conectar com atendente' },
    { id: 'error', title: 'Erro', description: 'Mensagem não compreendida' }
  ];

  useEffect(() => {
    loadMessages();
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
    }
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
          variables: messagesData?.messages[categoryId]?.variables || {}
        })
      });

      if (response.ok) {
        await loadMessages();
        setEditingCategory(null);
        setEditTemplate('');
      }
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
    }
    setSaving(false);
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
          <h2 className="text-2xl font-bold">Gerenciar Mensagens do Bot</h2>
          <p className="text-gray-600">Configure as respostas automáticas do WhatsApp</p>
        </div>
        <Button onClick={loadMessages} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Recarregar
        </Button>
      </div>

      <div className="grid gap-4">
        {categories.map((category) => {
          const messageData = messagesData?.messages[category.id];
          const isEditing = editingCategory === category.id;

          return (
            <Card key={category.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      {category.title}
                    </CardTitle>
                    <p className="text-sm text-gray-600">{category.description}</p>
                  </div>
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(category.id)}
                    >
                      Editar
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <Textarea
                      value={editTemplate}
                      onChange={(e) => setEditTemplate(e.target.value)}
                      placeholder="Digite o template da mensagem..."
                      className="min-h-[120px] font-mono text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveMessage(category.id)}
                        disabled={saving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCategory(null);
                          setEditTemplate('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messageData?.template ? (
                      <div className="bg-gray-50 p-3 rounded-md">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {messageData.template}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm">
                        Nenhuma mensagem configurada
                      </div>
                    )}

                    {messageData?.lastUpdated && (
                      <Badge variant="secondary" className="text-xs">
                        Atualizado: {new Date(messageData.lastUpdated).toLocaleString()}
                      </Badge>
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