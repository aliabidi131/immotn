import 'package:flutter_test/flutter_test.dart';

import 'package:immotn/listing_validation.dart';

void main() {
  test('price and surface must be finite positive numbers', () {
    expect(validatePositiveNumber('0'), isNotNull);
    expect(validatePositiveNumber('NaN'), isNotNull);
    expect(validatePositiveNumber('125000'), isNull);
  });

  test('room count must be a non-negative integer', () {
    expect(validateRoomCount('-1'), isNotNull);
    expect(validateRoomCount('2.5'), isNotNull);
    expect(validateRoomCount('3'), isNull);
  });

  test('required text fields reject empty values', () {
    expect(validateRequiredField(' '), isNotNull);
    expect(validateRequiredField('Tunis'), isNull);
  });
}
