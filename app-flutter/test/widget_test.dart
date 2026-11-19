// Basic widget test for ImmoTN - validates the core logic works.
import 'package:flutter_test/flutter_test.dart';

import 'package:immotn/listing_validation.dart';

void main() {
  test('validation functions work correctly', () {
    // validatePositiveNumber
    expect(validatePositiveNumber('125000'), null);
    expect(validatePositiveNumber('0'), isNotNull);
    expect(validatePositiveNumber('-100'), isNotNull);
    expect(validatePositiveNumber('abc'), isNotNull);

    // validateRoomCount
    expect(validateRoomCount('3'), null);
    expect(validateRoomCount('-1'), isNotNull);
    expect(validateRoomCount('2.5'), isNotNull);

    // validateRequiredField
    expect(validateRequiredField(''), isNotNull);
    expect(validateRequiredField('Tunis'), null);
  });
}