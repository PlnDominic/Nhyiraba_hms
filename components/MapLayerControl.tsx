import React from 'react';

interface MapLayerControlProps {
  activeLayer: string;
  changeBaseLayer: (layerType: string) => void;
}

const MapLayerControl: React.FC<MapLayerControlProps> = (props) => {
  const layerTypes = [
    { id: 'streets', name: 'Streets' },
    { id: 'satellite', name: 'Satellite' },
    { id: 'terrain', name: 'Terrain' },
  ];

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 z-10">
      <div className="text-sm font-medium text-gray-700 mb-2 px-2">Map Style</div>
      <div className="space-y-1">
        {layerTypes.map((layer) => (
          <button
            key={layer.id}
            type="button"
            onClick={() => props.changeBaseLayer(layer.id)}
            className={`w-full text-left px-3 py-2 rounded transition-colors ${
              props.activeLayer === layer.id
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'hover:bg-gray-50'
            }`}
          >
            {layer.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MapLayerControl;
