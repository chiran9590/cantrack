import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, [this.status]);
  @override
  String toString() => message;
}

class User {
  final int id;
  final String name;
  final String email;
  final String role;
  User({required this.id, required this.name, required this.email, required this.role});
  factory User.fromJson(Map<String, dynamic> j) =>
      User(id: j['id'] as int, name: j['name'] as String, email: j['email'] as String, role: j['role'] as String);
}

/// Talks to the CanTrack FastAPI backend. The login token is kept in the phone's secure storage.
class Api {
  Api._();
  static final Api instance = Api._();
  static const _store = FlutterSecureStorage();

  String baseUrl = '';
  String? _token;
  void Function()? onExpired;

  bool get signedIn => _token != null;

  Future<void> load() async {
    baseUrl = await _store.read(key: 'base') ?? '';
    _token = await _store.read(key: 'token');
  }

  Future<void> logout() async {
    _token = null;
    await _store.delete(key: 'token');
  }

  Future<dynamic> _call(String method, String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl/api$path');
    final headers = {
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };
    http.Response res;
    try {
      final req = method == 'GET'
          ? http.get(uri, headers: headers)
          : http.post(uri, headers: headers, body: jsonEncode(body ?? {}));
      res = await req.timeout(const Duration(seconds: 10));
    } on Exception {
      throw ApiException('Cannot reach the server. Check Wi-Fi and the server address.');
    }
    dynamic data;
    try {
      data = jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      data = <String, dynamic>{};
    }
    if (res.statusCode == 401 && path != '/auth/login') onExpired?.call();
    if (res.statusCode >= 400) {
      final msg = data is Map ? data['error']?.toString() : null;
      throw ApiException(msg ?? 'Request failed (${res.statusCode})', res.statusCode);
    }
    return data;
  }

  Future<User> login(String server, String email, String password) async {
    var s = server.trim().replaceAll(RegExp(r'/+$'), '');
    if (!s.startsWith('http://') && !s.startsWith('https://')) s = 'http://$s';
    baseUrl = s;
    final d = await _call('POST', '/auth/login', body: {'email': email, 'password': password});
    _token = d['token'] as String;
    await _store.write(key: 'base', value: baseUrl);
    await _store.write(key: 'token', value: _token);
    return User.fromJson(d['user'] as Map<String, dynamic>);
  }

  Future<User> me() async => User.fromJson(await _call('GET', '/auth/me') as Map<String, dynamic>);

  /// Records a scan. Returns the server's confirmation text, or throws ApiException with the reason it was rejected.
  Future<String> scan(String positionId, String plantUuid, String sessionId) async {
    final d = await _call('POST', '/scans', body: {
      'position_id': positionId,
      'plant_uuid': plantUuid,
      'session_id': sessionId,
      'source': 'mobile',
      'device': Platform.operatingSystem,
    });
    return d['message'] as String;
  }
}
