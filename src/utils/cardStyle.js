export const getCardStyle = (rating) => {
  if (rating <= 64) return 'bg-[#CD7F32] text-black';
  if (rating >= 65 && rating <= 74) return 'bg-[#C0C0C0] text-black';
  return 'bg-[#FFD700] text-black';
};

// Variante solo borde/texto (fondo oscuro fijo) para las fichas de la pizarra táctica.
export const getPitchTierStyle = (rating) => {
  if (rating <= 64) return 'border-[#CD7F32] text-[#CD7F32]';
  if (rating >= 65 && rating <= 74) return 'border-[#C0C0C0] text-[#C0C0C0]';
  return 'border-[#FFD700] text-[#FFD700]';
};
