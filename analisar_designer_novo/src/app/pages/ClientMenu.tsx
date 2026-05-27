import { useState } from 'react';
import { LogOut, ShoppingBag, Flame, Receipt, Plus, Minus } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { mockProducts, mockClients, OrderItem } from '../data/mockData';
import { ProgressBar } from '../components/ui/ProgressBar';

export function ClientMenu() {
  const [activeTab, setActiveTab] = useState<'categories' | 'popular' | 'order'>('categories');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const currentClient = mockClients[0];

  const popularProducts = mockProducts.filter(p => p.popular);

  const addToOrder = (productId: string, productName: string, price: number) => {
    setOrderItems(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        return prev.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId, productName, quantity: 1, price }];
    });
  };

  const removeFromOrder = (productId: string) => {
    setOrderItems(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter(item => item.productId !== productId);
    });
  };

  const getQuantity = (productId: string) => {
    return orderItems.find(item => item.productId === productId)?.quantity || 0;
  };

  const orderTotal = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalItems = orderItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="min-h-screen bg-[#0d0d0d] pb-24">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-[#E5B25D] to-[#d4a14c] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#0d0d0d]">{currentClient.name}</h1>
            <p className="text-sm text-[#0d0d0d]/70">{currentClient.profile}</p>
          </div>
          <button className="p-2 rounded-xl bg-[#0d0d0d]/10 text-[#0d0d0d]">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Summary */}
        <Card glass className="bg-[rgba(13,13,13,0.3)]">
          <div className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#0d0d0d]/70">Limite Mensal</span>
              <span className="text-[#0d0d0d] font-medium">
                R$ {currentClient.monthlyLimit.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#0d0d0d]/70">Consumido</span>
              <span className="text-[#0d0d0d] font-medium">
                R$ {currentClient.consumed.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-[#0d0d0d]/70">Disponível</span>
              <span className="text-[#0d0d0d] font-semibold">
                R$ {(currentClient.monthlyLimit - currentClient.consumed).toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="h-2 bg-[#0d0d0d]/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0d0d0d]"
                style={{ width: `${(currentClient.consumed / currentClient.monthlyLimit) * 100}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 bg-[#1a1a1a] border-b border-[rgba(229,178,93,0.2)] z-10">
        <div className="flex">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-4 text-center transition-colors ${
              activeTab === 'categories'
                ? 'text-[#E5B25D] border-b-2 border-[#E5B25D]'
                : 'text-[#a0a0a0]'
            }`}
          >
            <ShoppingBag className="w-5 h-5 mx-auto mb-1" />
            <span className="text-sm">Categorias</span>
          </button>
          <button
            onClick={() => setActiveTab('popular')}
            className={`flex-1 py-4 text-center transition-colors ${
              activeTab === 'popular'
                ? 'text-[#E5B25D] border-b-2 border-[#E5B25D]'
                : 'text-[#a0a0a0]'
            }`}
          >
            <Flame className="w-5 h-5 mx-auto mb-1" />
            <span className="text-sm">Mais Pedidos</span>
          </button>
          <button
            onClick={() => setActiveTab('order')}
            className={`flex-1 py-4 text-center transition-colors relative ${
              activeTab === 'order'
                ? 'text-[#E5B25D] border-b-2 border-[#E5B25D]'
                : 'text-[#a0a0a0]'
            }`}
          >
            <Receipt className="w-5 h-5 mx-auto mb-1" />
            <span className="text-sm">Minha Comanda</span>
            {totalItems > 0 && (
              <span className="absolute top-2 right-1/4 w-5 h-5 bg-[#FF4757] text-white text-xs rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'categories' && (
          <div className="space-y-4">
            {mockProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <div className="flex gap-4 p-4">
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#E5B25D] to-[#d4a14c] flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-white font-medium mb-1">{product.name}</h3>
                    <p className="text-sm text-[#a0a0a0] mb-2">{product.category}</p>
                    <p className="text-lg text-[#E5B25D] font-semibold">
                      R$ {product.price.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-2">
                    {getQuantity(product.id) === 0 ? (
                      <button
                        onClick={() => addToOrder(product.id, product.name, product.price)}
                        className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#E5B25D] to-[#d4a14c] flex items-center justify-center text-[#0d0d0d]"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => addToOrder(product.id, product.name, product.price)}
                          className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#E5B25D] to-[#d4a14c] flex items-center justify-center text-[#0d0d0d]"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="text-white font-medium">{getQuantity(product.id)}</span>
                        <button
                          onClick={() => removeFromOrder(product.id)}
                          className="w-8 h-8 rounded-lg border border-[rgba(229,178,93,0.4)] flex items-center justify-center text-[#E5B25D]"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'popular' && (
          <div className="space-y-4">
            {popularProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <div className="flex gap-4 p-4">
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#E5B25D] to-[#d4a14c] flex-shrink-0 relative">
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#FF4757] rounded-full flex items-center justify-center">
                      <Flame className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-medium mb-1">{product.name}</h3>
                    <p className="text-sm text-[#a0a0a0] mb-2">{product.category}</p>
                    <p className="text-lg text-[#E5B25D] font-semibold">
                      R$ {product.price.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-2">
                    {getQuantity(product.id) === 0 ? (
                      <button
                        onClick={() => addToOrder(product.id, product.name, product.price)}
                        className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#E5B25D] to-[#d4a14c] flex items-center justify-center text-[#0d0d0d]"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => addToOrder(product.id, product.name, product.price)}
                          className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#E5B25D] to-[#d4a14c] flex items-center justify-center text-[#0d0d0d]"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="text-white font-medium">{getQuantity(product.id)}</span>
                        <button
                          onClick={() => removeFromOrder(product.id)}
                          className="w-8 h-8 rounded-lg border border-[rgba(229,178,93,0.4)] flex items-center justify-center text-[#E5B25D]"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'order' && (
          <div className="space-y-4">
            {orderItems.length === 0 ? (
              <Card>
                <div className="p-8 text-center">
                  <Receipt className="w-16 h-16 text-[#808080] mx-auto mb-4" />
                  <h3 className="text-xl text-white mb-2">Comanda Vazia</h3>
                  <p className="text-[#a0a0a0]">Adicione itens para começar seu pedido</p>
                </div>
              </Card>
            ) : (
              <>
                {orderItems.map((item) => (
                  <Card key={item.productId}>
                    <div className="flex items-center gap-4 p-4">
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">{item.productName}</h3>
                        <p className="text-sm text-[#a0a0a0]">
                          R$ {item.price.toFixed(2).replace('.', ',')} cada
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => removeFromOrder(item.productId)}
                          className="w-8 h-8 rounded-lg border border-[rgba(229,178,93,0.4)] flex items-center justify-center text-[#E5B25D]"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-white font-medium w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => addToOrder(item.productId, item.productName, item.price)}
                          className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#E5B25D] to-[#d4a14c] flex items-center justify-center text-[#0d0d0d]"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-lg text-[#E5B25D] font-semibold">
                          R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Button */}
      {orderItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1a1a1a] border-t border-[rgba(229,178,93,0.2)]">
          <Button className="w-full" size="lg">
            <Receipt className="w-5 h-5" />
            Finalizar Pedido - R$ {orderTotal.toFixed(2).replace('.', ',')}
          </Button>
        </div>
      )}
    </div>
  );
}
