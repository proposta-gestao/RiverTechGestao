import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, User, CreditCard, ShoppingCart, X, DollarSign } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { mockClients, mockProducts, OrderItem } from '../data/mockData';
import { ProgressBar } from '../components/ui/ProgressBar';

export function AttendantPanel() {
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState(mockClients[0]);
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([
    { productId: '2', productName: 'Heineken Long Neck', quantity: 3, price: 15.00 },
    { productId: '6', productName: 'Batata Frita com Cheddar', quantity: 1, price: 35.00 },
  ]);

  const orderTotal = currentOrder.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const newConsumed = selectedClient.consumed + orderTotal;
  const available = selectedClient.monthlyLimit - newConsumed;

  const orderHistory = [
    { date: '27/05/2026 14:30', items: 'Whisky Premium, Água Mineral', total: 255.00 },
    { date: '20/05/2026 19:45', items: 'Picanha Premium, Heineken x2', total: 150.00 },
    { date: '15/05/2026 18:20', items: 'Mojito x2, Batata Frita', total: 99.00 },
  ];

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
          <h2 className="text-3xl font-semibold text-white mb-2">Painel do Atendente</h2>
          <p className="text-[#a0a0a0]">Gerencie comandas e pagamentos de clientes premium</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Selection */}
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Cliente Selecionado</h3>
                <div className="flex items-center gap-4 p-4 bg-[#222222] rounded-xl">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#E5B25D] to-[#d4a14c] flex items-center justify-center text-[#0d0d0d] text-xl font-semibold">
                    {selectedClient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg text-white font-medium">{selectedClient.name}</h4>
                    <p className="text-sm text-[#a0a0a0]">CPF: {selectedClient.cpf}</p>
                    <p className="text-sm text-[#a0a0a0]">Perfil: {selectedClient.profile}</p>
                  </div>
                  <button className="px-4 py-2 rounded-xl border border-[rgba(229,178,93,0.4)] text-[#E5B25D] hover:bg-[#E5B25D]/10 transition-colors">
                    Trocar Cliente
                  </button>
                </div>
              </div>
            </Card>

            {/* Current Order */}
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">Comanda Atual</h3>
                  <span className="px-4 py-2 rounded-full bg-[#00B894]/20 text-[#00B894] text-sm font-medium">
                    Em Andamento
                  </span>
                </div>

                <div className="space-y-4 mb-6">
                  {currentOrder.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-[#222222] rounded-xl">
                      <div className="flex-1">
                        <h4 className="text-white font-medium mb-1">{item.productName}</h4>
                        <p className="text-sm text-[#a0a0a0]">
                          Quantidade: {item.quantity} x R$ {item.price.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg text-[#E5B25D] font-semibold">
                          R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      <button className="p-2 rounded-lg text-[#FF4757] hover:bg-[#FF4757]/10 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-[rgba(229,178,93,0.2)]">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-xl text-white font-semibold">Total da Comanda</span>
                    <span className="text-2xl text-[#E5B25D] font-bold">
                      R$ {orderTotal.toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button variant="secondary" className="w-full">
                      <X className="w-5 h-5" />
                      Cancelar
                    </Button>
                    <Button variant="outline" className="w-full">
                      <DollarSign className="w-5 h-5" />
                      Pag. Parcial
                    </Button>
                    <Button className="w-full">
                      <ShoppingCart className="w-5 h-5" />
                      Fechar Comanda
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Order History */}
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Histórico de Comandas</h3>
                <div className="space-y-3">
                  {orderHistory.map((order, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-[#222222] rounded-xl">
                      <div className="flex-1">
                        <p className="text-white font-medium mb-1">{order.date}</p>
                        <p className="text-sm text-[#a0a0a0]">{order.items}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg text-white font-semibold">
                          R$ {order.total.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Resumo Financeiro</h3>

                <div className="space-y-6">
                  <div className="p-4 bg-[#222222] rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#E5B25D] to-[#d4a14c] flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-[#0d0d0d]" />
                      </div>
                      <span className="text-sm text-[#a0a0a0]">Limite Mensal</span>
                    </div>
                    <p className="text-2xl text-white font-bold">
                      R$ {selectedClient.monthlyLimit.toFixed(2).replace('.', ',')}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-[#a0a0a0]">Consumido Anterior</span>
                      <span className="text-sm text-white font-medium">
                        R$ {selectedClient.consumed.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-[#a0a0a0]">Comanda Atual</span>
                      <span className="text-sm text-[#E5B25D] font-medium">
                        + R$ {orderTotal.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2 pt-2 border-t border-[rgba(229,178,93,0.2)]">
                      <span className="text-sm text-[#a0a0a0]">Total Consumido</span>
                      <span className="text-sm text-white font-medium">
                        R$ {newConsumed.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="flex justify-between mb-4">
                      <span className="text-sm text-[#a0a0a0]">Disponível</span>
                      <span className={`text-sm font-medium ${
                        available < 0 ? 'text-[#FF4757]' : 'text-[#00B894]'
                      }`}>
                        R$ {available.toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    <ProgressBar value={newConsumed} max={selectedClient.monthlyLimit} />
                  </div>

                  {available < 0 && (
                    <div className="p-4 bg-[#FF4757]/10 border border-[#FF4757]/30 rounded-xl">
                      <p className="text-sm text-[#FF4757]">
                        ⚠️ Atenção: Esta comanda excede o limite disponível do cliente
                      </p>
                    </div>
                  )}

                  <div className="pt-6 border-t border-[rgba(229,178,93,0.2)]">
                    <p className="text-sm text-[#a0a0a0] mb-2">Status da conta</p>
                    <div className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${
                      selectedClient.status === 'ativo'
                        ? 'bg-[#00B894]/20 text-[#00B894]'
                        : 'bg-[#FF4757]/20 text-[#FF4757]'
                    }`}>
                      {selectedClient.status === 'ativo' ? 'Conta Ativa' : 'Conta Bloqueada'}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
