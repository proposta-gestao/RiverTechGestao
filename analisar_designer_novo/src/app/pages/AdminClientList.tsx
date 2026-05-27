import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Users, DollarSign, TrendingUp, CreditCard, Search, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { mockClients } from '../data/mockData';
import { ProgressBar } from '../components/ui/ProgressBar';

export function AdminClientList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = mockClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cpf.includes(searchTerm) ||
    client.phone.includes(searchTerm)
  );

  const totalClients = mockClients.length;
  const totalConsumed = mockClients.reduce((acc, client) => acc + client.consumed, 0);
  const totalLimit = mockClients.reduce((acc, client) => acc + client.monthlyLimit, 0);
  const totalAvailable = totalLimit - totalConsumed;

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 h-screen bg-[#1a1a1a] border-r border-[rgba(229,178,93,0.2)] fixed left-0 top-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E5B25D] to-[#d4a14c] flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-[#0d0d0d]" />
              </div>
              <h1 className="text-xl font-semibold text-white">Premium Club</h1>
            </div>

            <nav className="space-y-2">
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#E5B25D] to-[#d4a14c] text-[#0d0d0d]"
              >
                <Users className="w-5 h-5" />
                <span>Clientes</span>
              </button>
              <button
                onClick={() => navigate('/admin/profiles')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#a0a0a0] hover:bg-[#222222] hover:text-white transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                <span>Perfis de Cardápio</span>
              </button>
              <button
                onClick={() => navigate('/attendant')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#a0a0a0] hover:bg-[#222222] hover:text-white transition-colors"
              >
                <Eye className="w-5 h-5" />
                <span>Painel Atendente</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-64 flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-semibold text-white mb-2">Gestão de Clientes Premium</h2>
              <p className="text-[#a0a0a0]">Gerencie clientes, limites e consumo mensal</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total de Clientes"
                value={totalClients}
                icon={Users}
              />
              <StatCard
                title="Consumo do Mês"
                value={`R$ ${totalConsumed.toFixed(2).replace('.', ',')}`}
                icon={TrendingUp}
                trend={{ value: '+12% vs mês anterior', isPositive: true }}
              />
              <StatCard
                title="Limite Total"
                value={`R$ ${totalLimit.toFixed(2).replace('.', ',')}`}
                icon={DollarSign}
              />
              <StatCard
                title="Valor Disponível"
                value={`R$ ${totalAvailable.toFixed(2).replace('.', ',')}`}
                icon={CreditCard}
              />
            </div>

            {/* Search and Actions */}
            <Card className="mb-6">
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#808080]" />
                    <input
                      type="text"
                      placeholder="Buscar por nome, CPF ou telefone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#222222] border border-[rgba(229,178,93,0.2)] text-white placeholder:text-[#808080] focus:outline-none focus:ring-2 focus:ring-[#E5B25D]/50"
                    />
                  </div>
                  <Button onClick={() => navigate('/admin/client/new')}>
                    <Plus className="w-5 h-5" />
                    Novo Cliente
                  </Button>
                </div>
              </div>
            </Card>

            {/* Clients Table */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(229,178,93,0.2)]">
                      <th className="text-left p-4 text-sm text-[#a0a0a0]">Nome</th>
                      <th className="text-left p-4 text-sm text-[#a0a0a0]">CPF</th>
                      <th className="text-left p-4 text-sm text-[#a0a0a0]">Tipo</th>
                      <th className="text-left p-4 text-sm text-[#a0a0a0]">Perfil</th>
                      <th className="text-right p-4 text-sm text-[#a0a0a0]">Limite Mensal</th>
                      <th className="text-right p-4 text-sm text-[#a0a0a0]">Consumido</th>
                      <th className="text-right p-4 text-sm text-[#a0a0a0]">% Utilizado</th>
                      <th className="text-center p-4 text-sm text-[#a0a0a0]">Status</th>
                      <th className="text-center p-4 text-sm text-[#a0a0a0]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => {
                      const percentage = (client.consumed / client.monthlyLimit) * 100;
                      return (
                        <tr
                          key={client.id}
                          className="border-b border-[rgba(229,178,93,0.1)] hover:bg-[#222222] transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E5B25D] to-[#d4a14c] flex items-center justify-center text-[#0d0d0d] font-medium">
                                {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <div>
                                <p className="text-white font-medium">{client.name}</p>
                                <p className="text-sm text-[#a0a0a0]">{client.phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-white">{client.cpf}</td>
                          <td className="p-4">
                            <span className={`inline-flex px-3 py-1 rounded-full text-sm ${
                              client.type === 'VIP' ? 'bg-[#E5B25D]/20 text-[#E5B25D]' :
                              client.type === 'Funcionário' ? 'bg-[#1E90FF]/20 text-[#1E90FF]' :
                              'bg-[#a0a0a0]/20 text-[#a0a0a0]'
                            }`}>
                              {client.type}
                            </span>
                          </td>
                          <td className="p-4 text-white">{client.profile}</td>
                          <td className="p-4 text-right text-white">
                            R$ {client.monthlyLimit.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="p-4 text-right text-white">
                            R$ {client.consumed.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-sm font-medium ${
                                percentage >= 90 ? 'text-[#FF4757]' :
                                percentage >= 70 ? 'text-[#FDCB6E]' :
                                'text-[#00B894]'
                              }`}>
                                {percentage.toFixed(0)}%
                              </span>
                              <div className="w-20 h-1.5 bg-[#222222] rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    percentage >= 90 ? 'bg-[#FF4757]' :
                                    percentage >= 70 ? 'bg-[#FDCB6E]' :
                                    'bg-gradient-to-r from-[#E5B25D] to-[#d4a14c]'
                                  }`}
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center">
                              <span className={`inline-flex px-3 py-1 rounded-full text-sm ${
                                client.status === 'ativo'
                                  ? 'bg-[#00B894]/20 text-[#00B894]'
                                  : 'bg-[#FF4757]/20 text-[#FF4757]'
                              }`}>
                                {client.status === 'ativo' ? 'Ativo' : 'Bloqueado'}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => navigate(`/admin/client/${client.id}`)}
                                className="p-2 rounded-lg text-[#a0a0a0] hover:text-[#E5B25D] hover:bg-[#222222] transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                className="p-2 rounded-lg text-[#a0a0a0] hover:text-[#FF4757] hover:bg-[#222222] transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
