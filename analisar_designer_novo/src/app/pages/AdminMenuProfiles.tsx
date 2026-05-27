import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Save, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { mockMenuProfiles, allCategories, allProducts } from '../data/mockData';

export function AdminMenuProfiles() {
  const navigate = useNavigate();
  const [selectedProfile, setSelectedProfile] = useState(mockMenuProfiles[0]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(selectedProfile.categories);
  const [selectedProducts, setSelectedProducts] = useState<string[]>(selectedProfile.products);

  const handleProfileChange = (profileId: string) => {
    const profile = mockMenuProfiles.find(p => p.id === profileId);
    if (profile) {
      setSelectedProfile(profile);
      setSelectedCategories(profile.categories);
      setSelectedProducts(profile.products);
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleProduct = (product: string) => {
    setSelectedProducts(prev =>
      prev.includes(product)
        ? prev.filter(p => p !== product)
        : [...prev, product]
    );
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[#a0a0a0] hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h2 className="text-3xl font-semibold text-white mb-2">Perfis de Cardápio</h2>
          <p className="text-[#a0a0a0]">Configure o que cada perfil pode visualizar e comprar</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Profile Selector */}
          <div className="lg:col-span-1">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Perfis</h3>
                <div className="space-y-2">
                  {mockMenuProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleProfileChange(profile.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                        selectedProfile.id === profile.id
                          ? 'bg-gradient-to-r from-[#E5B25D] to-[#d4a14c] text-[#0d0d0d] font-medium'
                          : 'text-[#a0a0a0] hover:bg-[#222222] hover:text-white'
                      }`}
                    >
                      {profile.name}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Configuration */}
          <div className="lg:col-span-3 space-y-6">
            {/* Categories */}
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-2">Categorias Permitidas</h3>
                <p className="text-sm text-[#a0a0a0] mb-6">
                  Selecione quais categorias estarão disponíveis para este perfil
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allCategories.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-3 p-4 rounded-xl border border-[rgba(229,178,93,0.2)] cursor-pointer hover:bg-[#222222] transition-colors"
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category)}
                          onChange={() => toggleCategory(category)}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 border-2 border-[rgba(229,178,93,0.4)] rounded peer-checked:bg-gradient-to-r peer-checked:from-[#E5B25D] peer-checked:to-[#d4a14c] peer-checked:border-[#E5B25D] transition-all flex items-center justify-center">
                          {selectedCategories.includes(category) && (
                            <Check className="w-3 h-3 text-[#0d0d0d]" />
                          )}
                        </div>
                      </div>
                      <span className="text-white">{category}</span>
                    </label>
                  ))}
                </div>
              </div>
            </Card>

            {/* Products */}
            <Card>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-2">Produtos Específicos</h3>
                <p className="text-sm text-[#a0a0a0] mb-6">
                  Defina produtos específicos que estarão disponíveis
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allProducts.map((product) => (
                    <label
                      key={product}
                      className="flex items-center gap-3 p-4 rounded-xl border border-[rgba(229,178,93,0.2)] cursor-pointer hover:bg-[#222222] transition-colors"
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product)}
                          onChange={() => toggleProduct(product)}
                          className="sr-only peer"
                        />
                        <div className="w-5 h-5 border-2 border-[rgba(229,178,93,0.4)] rounded peer-checked:bg-gradient-to-r peer-checked:from-[#E5B25D] peer-checked:to-[#d4a14c] peer-checked:border-[#E5B25D] transition-all flex items-center justify-center">
                          {selectedProducts.includes(product) && (
                            <Check className="w-3 h-3 text-[#0d0d0d]" />
                          )}
                        </div>
                      </div>
                      <span className="text-white">{product}</span>
                    </label>
                  ))}
                </div>
              </div>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button>
                <Save className="w-5 h-5" />
                Salvar Alterações
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
