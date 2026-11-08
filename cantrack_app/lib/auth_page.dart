import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';

class AuthPage extends StatefulWidget {
  final void Function(User) onAuth;
  const AuthPage({super.key, required this.onAuth});
  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  late final TextEditingController _server =
      TextEditingController(text: Api.instance.baseUrl.isNotEmpty ? Api.instance.baseUrl : 'http://192.168.1.10:4000');
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pw = TextEditingController();
  final _pw2 = TextEditingController();
  bool _register = false;
  bool _busy = false;
  String _err = '';

  Future<void> _submit() async {
    if (_register) {
      if (_name.text.trim().isEmpty) return setState(() => _err = 'Please enter your name');
      if (_pw.text.length < 8) return setState(() => _err = 'Password must be at least 8 characters');
      if (_pw.text != _pw2.text) return setState(() => _err = 'Passwords do not match');
    }
    setState(() {
      _busy = true;
      _err = '';
    });
    try {
      final u = _register
          ? await Api.instance.register(_server.text, _name.text.trim(), _email.text.trim(), _pw.text)
          : await Api.instance.login(_server.text, _email.text.trim(), _pw.text);
      widget.onAuth(u);
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _server.dispose();
    _name.dispose();
    _email.dispose();
    _pw.dispose();
    _pw2.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text.rich(TextSpan(children: [
                  TextSpan(text: 'Can'),
                  TextSpan(text: 'Track', style: TextStyle(color: kLime)),
                  TextSpan(text: ' 🌿'),
                ]), style: TextStyle(fontSize: 40, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(_register ? 'Create your account' : 'Sign in to continue', style: const TextStyle(color: Colors.white60)),
                const SizedBox(height: 24),
                TextField(controller: _server, keyboardType: TextInputType.url, autocorrect: false, decoration: inputDeco('Server address')),
                const SizedBox(height: 12),
                if (_register) ...[
                  TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: inputDeco('Full name')),
                  const SizedBox(height: 12),
                ],
                TextField(controller: _email, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: inputDeco('Email')),
                const SizedBox(height: 12),
                TextField(controller: _pw, obscureText: true, decoration: inputDeco('Password')),
                if (_register) ...[
                  const SizedBox(height: 12),
                  TextField(controller: _pw2, obscureText: true, decoration: inputDeco('Repeat password')),
                ],
                if (_err.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_err, style: const TextStyle(color: kRed))),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 18)),
                  child: _busy
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(_register ? 'Create account' : 'Sign in', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                ),
                if (_register)
                  const Padding(
                    padding: EdgeInsets.only(top: 12),
                    child: Text('No email verification needed. New accounts can view data; an administrator can give you scanning rights.',
                        textAlign: TextAlign.center, style: TextStyle(color: Colors.white38, fontSize: 12)),
                  ),
                TextButton(
                  onPressed: () => setState(() {
                    _register = !_register;
                    _err = '';
                  }),
                  child: Text(_register ? 'Already registered? Sign in' : 'New here? Create an account'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
