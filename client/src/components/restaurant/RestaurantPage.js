import React, { useState, useEffect } from 'react';
import { FaSearch, FaPlus, FaChartBar, FaUtensils, FaGlassMartiniAlt, FaFolder, FaTimes, FaEdit, FaTrash, FaMoneyBillWave, FaShoppingCart, FaStar, FaChartLine } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useRestaurant } from '../../context/RestaurantContext';
import { useInventory } from '../../context/InventoryContext';
import { useTheme } from '../../context/ThemeContext';
import MenuItemModal from './MenuItemModal';
import CategoryModal from './CategoryModal';
import OrderManagement from './OrderManagement';
import DashboardLayout from '../DashboardLayout';
import toast from 'react-hot-toast';
import supabase from '../../supabaseClient';

const RestaurantPage = () => {
  const { menuItems, categories, loading, error, fetchMenuItems, deleteMenuItem } = useRestaurant();
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeTab, setActiveTab] = useState('menu');
  const [isMenuItemModalOpen, setIsMenuItemModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [activeBarTab, setActiveBarTab] = useState('VIP pub');
  const [isCategoriesSectionExpanded, setIsCategoriesSectionExpanded] = useState(false);


  // Modal functions for Menu Items
  const openAddMenuItemModal = () => {
    setSelectedMenuItem(null);
    setIsMenuItemModalOpen(true);
  };

  // Filter menu items based on search term and category using useMemo to prevent unnecessary recalculations
  const filteredMenuItems = React.useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = categoryFilter === '' || item.category_id === categoryFilter;
      // Filter by active bar tab. Assuming item.bar_location exists. 
      // If it doesn't exist on old items, we might want to default them to 'VIP pub' or show them in all?
      // For now, strict filtering:
      const matchesBar = item.bar_location === activeBarTab || (!item.bar_location && activeBarTab === 'VIP pub'); // Fallback for old items to VIP pub

      return matchesSearch && matchesCategory && matchesBar;
    });
  }, [menuItems, searchTerm, categoryFilter, activeBarTab]);


  // Refresh menu items when the component mounts, with proper dependency handling
  useEffect(() => {
    let isMounted = true;

    const loadMenuItems = async () => {
      if (isMounted) {
        await fetchMenuItems();
      }
    };

    loadMenuItems();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array since fetchMenuItems is from context


  const openEditMenuItemModal = (item) => {
    setSelectedMenuItem(item);
    setIsMenuItemModalOpen(true);
  };

  const closeMenuItemModal = React.useCallback(() => {
    // Close the modal first
    setIsMenuItemModalOpen(false);
    setSelectedMenuItem(null);

    // Use setTimeout to allow the modal closing animation to complete
    // before refreshing the data to avoid UI jank
    setTimeout(() => {
      fetchMenuItems(); // Refresh menu items after modal closes to get latest data
    }, 300);
  }, [fetchMenuItems]);

  // Handle delete menu item
  const handleDeleteMenuItem = async (itemId) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      try {
        await deleteMenuItem(itemId);
        toast.success('Menu item deleted successfully');
      } catch (error) {
        console.error('Error deleting menu item:', error);
        toast.error('Failed to delete menu item');
      }
    }
  };

  // Modal functions for Categories
  const openAddCategoryModal = () => {
    setSelectedCategory(null);
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (category) => {
    setSelectedCategory(category);
    setIsCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setSelectedCategory(null);
  };

  // Content for the Restaurant page
  const pageContent = (
    <div className="flex flex-col h-full">
      {/* Action buttons row with Bar Selection */}
      <div className="mb-6 flex flex-wrap lg:flex-nowrap items-center justify-between gap-6">
        <div className="flex flex-wrap gap-4 items-center">
          <motion.button
            onClick={openAddMenuItemModal}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`relative overflow-hidden flex items-center justify-center px-5 py-2.5 rounded-lg shadow-md ${theme === 'dark'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-700/20'
              : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white shadow-blue-300/30'
              } transition-all duration-200`}
          >
            <motion.span
              className="absolute inset-0 bg-white opacity-10"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            />
            <FaPlus className="mr-2" />
            <span className="font-medium">Add Menu Item</span>
          </motion.button>
        </div>
      </div>

      {/* Bar Tabs */}
      <div className="mb-6">
        <div className="flex space-x-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg inline-flex">
          {['VIP pub', 'Entrance Pub / Reception', 'Poolside Pub', 'Pizza Palace'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveBarTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeBarTab === tab
                ? theme === 'dark'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-blue-600 shadow-md'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mb-6">
        <div className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>
          <nav className="flex -mb-px space-x-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('menu')}
              className={`py-3 px-4 font-medium text-sm inline-flex items-center whitespace-nowrap ${activeTab === 'menu'
                ? `border-b-2 border-blue-500 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`
                : `${theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`
                }`}
            >
              <FaUtensils className="mr-2" />
              Menu Management
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-3 px-4 font-medium text-sm inline-flex items-center whitespace-nowrap ${activeTab === 'orders'
                ? `border-b-2 border-blue-500 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`
                : `${theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`
                }`}
            >
              <FaChartBar className="mr-2" />
              Orders
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-3 px-4 font-medium text-sm inline-flex items-center whitespace-nowrap ${activeTab === 'inventory'
                ? `border-b-2 border-blue-500 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`
                : `${theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`
                }`}
            >
              <FaGlassMartiniAlt className="mr-2" />
              Bar Inventory
            </button>
          </nav>
        </div>

        {activeTab === 'menu' && (
          <div className="flex flex-wrap gap-4 mt-6">
            <div className={`flex-1 min-w-[300px] relative ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              <motion.div
                animate={{
                  opacity: searchTerm ? 0.8 : 0.6,
                  scale: searchTerm ? 1.1 : 1
                }}
                transition={{ duration: 0.2 }}
                className="absolute left-3 top-1/2 transform -translate-y-1/2"
              >
                <FaSearch
                  className={`${theme === 'dark'
                    ? searchTerm ? 'text-blue-400' : 'text-gray-500'
                    : searchTerm ? 'text-blue-500' : 'text-gray-400'
                    }`}
                />
              </motion.div>
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg shadow-sm backdrop-blur-sm ${theme === 'dark'
                  ? 'bg-gray-800/90 border-gray-700/80 text-white placeholder-gray-500'
                  : 'bg-white/90 border-gray-300/80 text-gray-800 placeholder-gray-400'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:border-blue-400/70`}
              />
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500 scale-x-0 origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: searchTerm ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />
              {searchTerm && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSearchTerm('')}
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full ${theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <FaTimes className="text-xs" />
                </motion.button>
              )}
            </div>

            <div className="flex-1 min-w-[200px] relative">
              <div className={`relative ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`}>
                <FaFolder className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm opacity-70" />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`w-full pl-10 pr-10 py-2 rounded-lg appearance-none shadow-sm backdrop-blur-sm ${theme === 'dark'
                  ? 'bg-gray-800/90 border-gray-700/80 text-white'
                  : 'bg-white/90 border-gray-300/80 text-gray-800'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:border-blue-400/70`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%235C6BC0' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                }}
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500 scale-x-0 origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: categoryFilter ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content based on active tab */}
      <div className="content-area flex-1 overflow-y-auto">
        {activeTab === 'menu' && (
          <div>
            {/* Categories Section - Futuristic UI */}
            {categories.length > 0 && (
              <div className="mb-8">
                <div
                  onClick={() => setIsCategoriesSectionExpanded(!isCategoriesSectionExpanded)}
                  className="flex items-center justify-between cursor-pointer mb-4"
                >
                  <h2 className={`text-lg font-semibold tracking-wide ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    <span className="inline-block border-b-2 border-blue-500 pb-1">Categories</span>
                  </h2>
                  <motion.div
                    initial={false}
                    animate={{ rotate: isCategoriesSectionExpanded ? 180 : 0 }}
                    className="mr-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </motion.div>
                </div>
                <AnimatePresence>
                  {isCategoriesSectionExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {categories.map(category => (
                          <motion.div
                            key={category.id}
                            onClick={() => openEditCategoryModal(category)}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            className={`relative overflow-hidden rounded-xl cursor-pointer py-3 px-4 shadow-sm ${theme === 'dark'
                              ? 'bg-gradient-to-br from-gray-800 to-gray-900 hover:shadow-lg hover:shadow-blue-900/10'
                              : 'bg-gradient-to-br from-white to-gray-50 hover:shadow-lg hover:shadow-blue-200/40'
                              } transition-all duration-200 border border-opacity-20 backdrop-blur-sm ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                              }`}
                          >
                            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: category.color || '#3B82F6' }}></div>
                            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10"
                              style={{
                                backgroundColor: category.color || '#3B82F6',
                                filter: 'blur(25px)',
                                transform: 'translate(30%, -30%)'
                              }}></div>

                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-full ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-white/80'} 
                                  shadow-sm backdrop-blur-sm border border-opacity-20 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                                }`}
                              >
                                <FaFolder className="text-base" style={{ color: category.color || '#3B82F6' }} />
                              </div>
                              <div>
                                <span className="font-medium line-clamp-1">{category.name}</span>
                                <span className={`text-xs block mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                  }`}>
                                  {filteredMenuItems.filter(item => item.category_id === category.id).length} items
                                </span>
                              </div>
                            </div>

                            <motion.div
                              className={`absolute inset-0 ${theme === 'dark' ? 'bg-blue-500' : 'bg-blue-400'} opacity-0`}
                              initial={{ opacity: 0 }}
                              whileHover={{ opacity: 0.03 }}
                              transition={{ duration: 0.2 }}
                            />
                          </motion.div>
                        ))}

                        {/* Add Category Button */}
                        <motion.div
                          onClick={openAddCategoryModal}
                          whileHover={{ scale: 1.03, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          className={`relative overflow-hidden rounded-xl cursor-pointer py-3 px-4 shadow-sm border border-dashed ${theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 hover:border-blue-700 hover:shadow-blue-900/10'
                            : 'bg-gray-50/50 border-gray-300 hover:border-blue-400 hover:shadow-blue-200/40'
                            } transition-all duration-200 flex items-center justify-center`}
                        >
                          <div className={`flex flex-col items-center ${theme === 'dark' ? 'text-gray-400 hover:text-blue-400' : 'text-gray-500 hover:text-blue-600'
                            }`}>
                            <FaPlus className="text-xl mb-1" />
                            <span className="text-sm font-medium">Add Category</span>
                          </div>

                          <motion.div
                            className={`absolute inset-0 ${theme === 'dark' ? 'bg-blue-500' : 'bg-blue-400'} opacity-0`}
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 0.03 }}
                            transition={{ duration: 0.2 }}
                          />
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Menu items grid */}
            {loading ? (
              <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className={`p-6 text-center ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                <p>Error loading menu items. Please try again later.</p>
              </div>
            ) : filteredMenuItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredMenuItems.map(item => (
                  <MenuItemCard
                    key={`menu-item-card-${item.id}`}
                    item={item}
                    theme={theme}
                    openEditMenuItemModal={openEditMenuItemModal}
                    handleDeleteMenuItem={handleDeleteMenuItem}
                  />
                ))}
              </div>
            ) : (
              <div className={`p-12 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                <FaSearch className="mx-auto text-4xl mb-4" />
                <p className="text-xl font-medium mb-2">No menu items found</p>
                <p>Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <OrderManagement activeBar={activeBarTab} />
          </div>
        )}

        {activeTab === 'inventory' && (
          <BarInventoryView activeBar={activeBarTab} />
        )}
      </div>
      {isMenuItemModalOpen && (
        <MenuItemModal
          isOpen={isMenuItemModalOpen}
          onClose={closeMenuItemModal}
          menuItem={selectedMenuItem}
        />
      )}
      {isCategoryModalOpen && (
        <CategoryModal
          isOpen={isCategoryModalOpen}
          onClose={closeCategoryModal}
          category={selectedCategory}
        />
      )}
    </div>
  );

  return (
    <DashboardLayout activeLink="Bar" title="Pub Management">
      {pageContent}
    </DashboardLayout>
  );
};

// Menu Item Card Component - memoized to prevent unnecessary re-renders
const MenuItemCard = React.memo(({ item, theme, openEditMenuItemModal, handleDeleteMenuItem }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, type: "spring" }}
      layout
      layoutId={`menu-item-${item.id}`}
      className={`rounded-xl shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}
    >
      {/* Header (always visible) */}
      <div
        onClick={toggleExpand}
        className={`p-4 cursor-pointer flex justify-between items-center ${!isExpanded && 'border-b-0'
          }`}
      >
        <div className="flex items-center">
          <h3 className="text-lg font-bold">{item.name}</h3>
          <motion.div
            initial={false}
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="ml-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </motion.div>
        </div>
        <span className={`font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
          GH₵{item.price.toFixed(2)}
        </span>
      </div>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {item.image_url && (
              <div className="h-48 overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="px-4 pb-4">
              {item.description && (
                <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {item.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                {item.is_vegetarian && (
                  <span className={`px-2 py-1 text-xs rounded-full ${theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'
                    }`}>
                    Vegetarian
                  </span>
                )}

                {item.is_vegan && (
                  <span className={`px-2 py-1 text-xs rounded-full ${theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'
                    }`}>
                    Vegan
                  </span>
                )}

                {item.is_gluten_free && (
                  <span className={`px-2 py-1 text-xs rounded-full ${theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    Gluten Free
                  </span>
                )}

                {item.restaurant_categories && (
                  <span className={`px-2 py-1 text-xs rounded-full ${theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-800'
                    }`}>
                    {item.restaurant_categories.name}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {item.preparation_time ? `${item.preparation_time} mins` : 'Prep time varies'}
                </span>

                <div className="flex space-x-2">
                  <button
                    className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      }`}
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditMenuItemModal(item);
                    }}
                  >
                    <FaEdit className="h-4 w-4" />
                  </button>
                  <button
                    className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-100 text-red-600'
                      }`}
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
                        handleDeleteMenuItem(item.id);
                      }
                    }}
                  >
                    <FaTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

const BarInventoryView = ({ activeBar }) => {
  const { fetchDepartmentStock } = useInventory(); // We need to import useInventory
  const { theme } = useTheme();
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStock = async () => {
      setLoading(true);
      const data = await fetchDepartmentStock(activeBar);
      setStockItems(data);
      setLoading(false);
    };
    loadStock();
  }, [activeBar]);

  if (loading) return <div className="p-8 text-center">Loading inventory...</div>;

  return (
    <div className={`rounded-xl shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold">Inventory for {activeBar}</h3>
      </div>
      {stockItems.length > 0 ? (
        <div className="overflow-x-auto">
          <table className={`w-full ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
            <thead className={theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Item Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Current Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Last Updated</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {stockItems.map(stock => (
                <tr key={stock.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{stock.item?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stock.item?.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold">{stock.current_stock}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(stock.last_updated).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500">
          No inventory items found for this location.
        </div>
      )}
    </div>
  );
};

export default RestaurantPage;
