String? validateRequiredField(String? value) {
  return value == null || value.trim().isEmpty ? 'Champ obligatoire.' : null;
}

String? validatePositiveNumber(String? value) {
  final number = num.tryParse(value ?? '');
  return number == null || !number.isFinite || number <= 0
      ? 'Valeur supérieure à zéro requise.'
      : null;
}

String? validateRoomCount(String? value) {
  final rooms = int.tryParse(value ?? '');
  return rooms == null || rooms < 0
      ? 'Saisissez un nombre entier positif ou nul.'
      : null;
}
