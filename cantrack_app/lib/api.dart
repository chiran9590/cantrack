import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  final int? status; // null = the server could not be reached
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

  bool get canScan => ['admin', 'manager', 'breeder', 'gardener'].contains(role);
  bool get canRemove => ['admin', 'manager', 'breeder'].contains(role);
  bool get canCorrect => role == 'admin' || role == 'manager';
}

/// Talks to the CanTrack FastAPI backend. The login token is kept in the phone's secure storage.
class Api {
  Api._();
  static final Api instance = Api._();
  static const _store = FlutterSecureStorage();

  String baseUrl = '';
  String? _token;
  User? user;
  void Function()? onExpired;

  bool get signedIn => _token != null;

  Future<void> load() async {
    baseUrl = await _store.read(key: 'base') ?? '';
    _token = await _store.read(key: 'token');
    final u = await _store.read(key: 'user');
    if (u != null) {
      try {
        user = User.fromJson(jsonDecode(u) as Map<String, dynamic>);
      } catch (_) {
        user = null;
      }
    }
  }

  Future<void> _remember(Map<String, dynamic> u) async {
    user = User.fromJson(u);
    await _store.write(key: 'user', value: jsonEncode(u));
  }

  Future<void> logout() async {
    _token = null;
    user = null;
    await _store.delete(key: 'token');
    await _store.delete(key: 'user');
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

  Map<String, dynamic> _map(dynamic d) => d as Map<String, dynamic>;
  List<Map<String, dynamic>> _list(dynamic d) => (d as List<dynamic>).cast<Map<String, dynamic>>();

  String _cleanServer(String server) {
    var s = server.trim().replaceAll(RegExp(r'/+$'), '');
    if (!s.startsWith('http://') && !s.startsWith('https://')) s = 'http://$s';
    return s;
  }

  Future<User> _authenticate(String server, String path, Map<String, dynamic> body) async {
    baseUrl = _cleanServer(server);
    final d = _map(await _call('POST', path, body: body));
    _token = d['token'] as String;
    await _store.write(key: 'base', value: baseUrl);
    await _store.write(key: 'token', value: _token);
    await _remember(_map(d['user']));
    return user!;
  }

  Future<User> login(String server, String email, String password) =>
      _authenticate(server, '/auth/login', {'email': email, 'password': password});

  /// Open sign-up: no e-mail verification. New accounts start as read-only members.
  Future<User> register(String server, String name, String email, String password) =>
      _authenticate(server, '/auth/register', {'name': name, 'email': email, 'password': password});

  Future<User> me() async {
    await _remember(_map(await _call('GET', '/auth/me')));
    return user!;
  }

  Future<void> changePassword(String current, String next) async {
    await _call('POST', '/auth/change-password', body: {'current_password': current, 'new_password': next});
  }

  Future<Map<String, dynamic>> dashboard() async => _map(await _call('GET', '/dashboard'));
  Future<List<Map<String, dynamic>>> facility() async => _list(await _call('GET', '/facility'));
  Future<Map<String, dynamic>> glassMap(String code, int platform) async => _map(await _call('GET', '/map/$code/$platform'));
  Future<Map<String, dynamic>> position(String id) async => _map(await _call('GET', '/positions/$id'));
  Future<List<Map<String, dynamic>>> search(String q) async => _list(await _call('GET', '/plants?q=${Uri.encodeQueryComponent(q)}'));
  Future<Map<String, dynamic>> plant(String uuid) async => _map(await _call('GET', '/plants/$uuid'));
  Future<Map<String, dynamic>> genotype(String gid) async => _map(await _call('GET', '/genotypes/${Uri.encodeComponent(gid)}'));

  Future<void> removePlant(String uuid, String reason) async {
    await _call('POST', '/plants/$uuid/remove', body: {'reason': reason});
  }

  Future<void> correct(String uuid, String positionId, String reason) async {
    await _call('POST', '/plants/$uuid/correction', body: {'position_id': positionId, 'reason': reason});
  }

  /// Records a scan. Returns the server's confirmation text, or throws ApiException with the reason it was rejected.
  Future<String> scan(String positionId, String plantUuid, String sessionId) async {
    final d = _map(await _call('POST', '/scans', body: {
      'position_id': positionId,
      'plant_uuid': plantUuid,
      'session_id': sessionId,
      'source': 'mobile',
      'device': Platform.operatingSystem,
    }));
    return d['message'] as String;
  }
}
