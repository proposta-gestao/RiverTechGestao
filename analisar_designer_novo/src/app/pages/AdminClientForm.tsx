import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Save, X } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { mockClients } from '../data/mockData';
import { ProgressBar } from '../components/ui/ProgressBar';

export function AdminClientForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = id !== 'new';
  const existingClient = isEditing ? mockClients.find(c => c.id === id) : null;

  const [formData, setFormData] = useState({
    name: existingClient?.name || '',
    cpf: existingClient?.cpf || '',
    phone: existingClient?.phone || '',
    password: existingClient?.password || '',
    type: existingClient?.type || 'VIP',
    profile: existingClient?.profile || 'VIP Diretoria',
    monthlyLimit: existingClient?.monthlyLimit || 5000,
    status: existingClient?.status || 'ativo',
    notes: existingClient?.notes || '',
  });

  const consumed = existingClient?.consumed || 0;
  const available = formData.monthlyLimit - consumed;

  return (
    <div className="min-h-screen bg-[#0d0d0d] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[#a0a0a0] hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h2 className="text-3xl font-semibold text-white mb-2">
            {isEditing ? 'Editar Cliente' : 'Novo Cliente Premium'}
          </h2>
          <p className="text-[#a0a0a0]">
            {isEditing ? 'Atualize as informações do cliente' : 'Cadastre um novo cliente premium'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Data */}
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Dados Pessoais</h3>
                <div className="space-y-4">
                  <Input
                    label="Nome completo"
                    placeholder="Ex: João da Silva"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="CPF"
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    />
                    <Input
                      label="Telefone"
                      placeholder="(11) 90000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Access */}
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Acesso</h3>
                <Input
                  label="Senha de acesso"
                  type="password"
                  placeholder="Digite a senha"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </Card>

            {/* Configuration */}
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Configuração</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm text-[#a0a0a0]">Tipo de cliente</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[rgba(229,178,93,0.2)] text-white focus:outline-none focus:ring-2 focus:ring-[#E5B25D]/50"
                      >
                        <option value="VIP">VIP</option>
                        <option value="Funcionário">Funcionário</option>
                        <option value="Convidado">Convidado</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm text-[#a0a0a0]">Perfil de cardápio</label>
                      <select
                        value={formData.profile}
                        onChange={(e) => setFormData({ ...formData, profile: e.target.value as any })}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[rgba(229,178,93,0.2)] text-white focus:outline-none focus:ring-2 focus:ring-[#E5B25D]/50"
                      >
                        <option value="VIP Diretoria">VIP Diretoria</option>
                        <option value="Funcionários">Funcionários</option>
                        <option value="Convidados">Convidados</option>
                        <option value="Cortesia">Cortesia</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Financial */}
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Financeiro</h3>
                <div className="space-y-4">
                  <Input
                    label="Limite mensal (R$)"
                    type="number"
                    placeholder="5000.00"
                    value={formData.monthlyLimit}
                    onChange={(e) => setFormData({ ...formData, monthlyLimit: parseFloat(e.target.value) || 0 })}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm text-[#a0a0a0]">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[rgba(229,178,93,0.2)] text-white focus:outline-none focus:ring-2 focus:ring-[#E5B25D]/50"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="bloqueado">Bloqueado</option>
                    </select>
                  </div>
                </div>
              </div>
            </Card>

            {/* Notes */}
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Observações</h3>
                <textarea
                  placeholder="Notas adicionais sobre o cliente..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[rgba(229,178,93,0.2)] text-white placeholder:text-[#808080] focus:outline-none focus:ring-2 focus:ring-[#E5B25D]/50 resize-none"
                />
              </div>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => navigate('/')}>
                <X className="w-5 h-5" />
                Cancelar
              </Button>
              <Button onClick={() => navigate('/')}>
                <Save className="w-5 h-5" />
                Salvar Cliente
              </Button>
            </div>
          </div>

          {/* Summary Sidebar */}
          {isEditing && (
            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-white mb-6">Resumo do Consumo</h3>

                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-[#a0a0a0]">Limite Mensal</span>
                        <span className="text-sm text-white font-medium">
                          R$ {formData.monthlyLimit.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-[#a0a0a0]">Consumido</span>
                        <span className="text-sm text-white font-medium">
                          R$ {consumed.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <div className="flex justify-between mb-4">
                        <span className="text-sm text-[#a0a0a0]">Disponível</span>
                        <span className="text-sm font-medium text-[#00B894]">
                          R$ {available.toFixed(2).replace('.', ',')}
                        </span>
                      </div>

                      <ProgressBar value={consumed} max={formData.monthlyLimit} />
                    </div>

                    <div className="pt-6 border-t border-[rgba(229,178,93,0.2)]">
                      <p className="text-sm text-[#a0a0a0] mb-2">Status da conta</p>
                      <div className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${
                        formData.status === 'ativo'
                          ? 'bg-[#00B894]/20 text-[#00B894]'
                          : 'bg-[#FF4757]/20 text-[#FF4757]'
                      }`}>
                        {formData.status === 'ativo' ? 'Conta Ativa' : 'Conta Bloqueada'}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
